// WebRTC configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export class WebRTCManager {
  constructor(socket) {
    this.socket = socket;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCallRecipient = null;
    this.callType = null; // 'audio' or 'video'
    
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('incoming-call', async (data) => {
      await this.handleIncomingCall(data);
    });

    this.socket.on('call-answered', async (data) => {
      await this.handleCallAnswered(data);
    });

    this.socket.on('ice-candidate', async (data) => {
      await this.handleIceCandidate(data);
    });

    this.socket.on('call-ended', () => {
      this.endCall();
    });

    this.socket.on('call-rejected', () => {
      this.handleCallRejected();
    });
  }

  async startCall(recipient, callType = 'audio') {
    try {
      this.currentCallRecipient = recipient;
      this.callType = callType;

      // Get user media
      const constraints = {
        audio: true,
        video: callType === 'video'
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Show call UI
      this.showCallUI(callType, 'outgoing');
      
      // Setup local video/audio
      const localVideo = document.getElementById('local-video');
      if (localVideo) {
        localVideo.srcObject = this.localStream;
      }

      // Create peer connection
      this.createPeerConnection();

      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socket.emit('call-user', {
        to: recipient,
        offer: offer,
        callType: callType
      });

    } catch (error) {
      console.error('Error starting call:', error);
      alert('Could not access camera/microphone: ' + error.message);
      this.endCall();
    }
  }

  async handleIncomingCall(data) {
    const { from, offer, callType } = data;
    this.currentCallRecipient = from;
    this.callType = callType;

    // Show incoming call modal
    this.showIncomingCallModal(from, callType, async (accepted) => {
      if (accepted) {
        try {
          // Get user media
          const constraints = {
            audio: true,
            video: callType === 'video'
          };

          this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          // Show call UI
          this.showCallUI(callType, 'incoming');
          
          // Setup local video/audio
          const localVideo = document.getElementById('local-video');
          if (localVideo) {
            localVideo.srcObject = this.localStream;
          }

          // Create peer connection
          this.createPeerConnection();

          // Add tracks
          this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
          });

          // Set remote description
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

          // Create answer
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);

          // Send answer
          this.socket.emit('call-answer', {
            to: from,
            answer: answer
          });

        } catch (error) {
          console.error('Error accepting call:', error);
          alert('Could not access camera/microphone: ' + error.message);
          this.rejectCall();
        }
      } else {
        this.rejectCall();
      }
    });
  }

  async handleCallAnswered(data) {
    const { answer } = data;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    this.updateCallStatus('Connected');
  }

  async handleIceCandidate(data) {
    const { candidate } = data;
    if (this.peerConnection && candidate) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          to: this.currentCallRecipient,
          candidate: event.candidate
        });
      }
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) {
          remoteVideo.srcObject = this.remoteStream;
        }
      }
      this.remoteStream.addTrack(event.track);
      this.updateCallStatus('Connected');
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'disconnected' || 
          this.peerConnection.connectionState === 'failed') {
        this.endCall();
      }
    };
  }

  endCall() {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Notify other user
    if (this.currentCallRecipient) {
      this.socket.emit('end-call', { to: this.currentCallRecipient });
    }

    // Hide call UI
    this.hideCallUI();

    this.currentCallRecipient = null;
    this.remoteStream = null;
    this.callType = null;
  }

  rejectCall() {
    if (this.currentCallRecipient) {
      this.socket.emit('reject-call', { to: this.currentCallRecipient });
    }
    this.hideIncomingCallModal();
    this.currentCallRecipient = null;
  }

  handleCallRejected() {
    alert('Call was rejected');
    this.endCall();
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // Return muted state
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return !videoTrack.enabled; // Return disabled state
      }
    }
    return false;
  }

  showIncomingCallModal(from, callType, callback) {
    const modal = document.createElement('div');
    modal.id = 'incoming-call-modal';
    modal.className = 'call-modal';
    modal.innerHTML = `
      <div class="call-modal-content">
        <div class="call-icon">${callType === 'video' ? '📹' : '📞'}</div>
        <h3>Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call</h3>
        <p>${from.slice(0, -4)} is calling...</p>
        <div class="call-modal-buttons">
          <button class="reject-call-btn" id="reject-call-btn">❌ Reject</button>
          <button class="accept-call-btn" id="accept-call-btn">✅ Accept</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('accept-call-btn').onclick = () => {
      this.hideIncomingCallModal();
      callback(true);
    };

    document.getElementById('reject-call-btn').onclick = () => {
      callback(false);
    };
  }

  hideIncomingCallModal() {
    const modal = document.getElementById('incoming-call-modal');
    if (modal) {
      modal.remove();
    }
  }

  showCallUI(callType, direction) {
    const callUI = document.createElement('div');
    callUI.id = 'call-ui';
    callUI.className = 'call-ui';
    callUI.innerHTML = `
      <div class="call-container">
        <div class="call-header">
          <span id="call-status">${direction === 'outgoing' ? 'Calling...' : 'Incoming call...'}</span>
          <button class="end-call-btn" onclick="window.webrtcManager.endCall()">End Call</button>
        </div>
        <div class="video-container">
          <video id="remote-video" autoplay playsinline class="remote-video"></video>
          <video id="local-video" autoplay playsinline muted class="local-video"></video>
        </div>
        <div class="call-controls">
          <button class="control-btn" id="mute-btn" onclick="window.toggleMute()">
            <span id="mute-icon">🎤</span>
          </button>
          ${callType === 'video' ? `
            <button class="control-btn" id="video-btn" onclick="window.toggleVideo()">
              <span id="video-icon">📹</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(callUI);
  }

  hideCallUI() {
    const callUI = document.getElementById('call-ui');
    if (callUI) {
      callUI.remove();
    }
  }

  updateCallStatus(status) {
    const statusEl = document.getElementById('call-status');
    if (statusEl) {
      statusEl.textContent = status;
    }
  }
}

// Global toggle functions
window.toggleMute = () => {
  if (window.webrtcManager) {
    const isMuted = window.webrtcManager.toggleMute();
    const icon = document.getElementById('mute-icon');
    if (icon) {
      icon.textContent = isMuted ? '🔇' : '🎤';
    }
  }
};

window.toggleVideo = () => {
  if (window.webrtcManager) {
    const isDisabled = window.webrtcManager.toggleVideo();
    const icon = document.getElementById('video-icon');
    if (icon) {
      icon.textContent = isDisabled ? '📹❌' : '📹';
    }
  }
};