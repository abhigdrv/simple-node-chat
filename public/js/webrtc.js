// WebRTC configuration with multiple STUN servers and better fallbacks
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Add these free TURN servers as fallback
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    { 
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

export class WebRTCManager {
  constructor(socket) {
    this.socket = socket;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCallRecipient = null;
    this.callType = null;
    this.pendingIceCandidates = []; // Buffer for ICE candidates
    this.isInitiator = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    
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
      this.isInitiator = true;
      this.connectionAttempts++;

      console.log(`Starting ${callType} call to ${recipient} (attempt ${this.connectionAttempts})`);

      // Get user media
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
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
        console.log(`Adding ${track.kind} track to peer connection`);
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Create and send offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('Local description set, sending offer');

      this.socket.emit('call-user', {
        to: recipient,
        offer: offer,
        callType: callType
      });

      // Set timeout for call connection
      this.setCallTimeout();

    } catch (error) {
      console.error('Error starting call:', error);
      let errorMessage = 'Could not start call: ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Permission denied. Please allow camera/microphone access.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera/microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera/microphone is already in use.';
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
      this.endCall();
    }
  }

  async handleIncomingCall(data) {
    const { from, offer, callType } = data;
    this.currentCallRecipient = from;
    this.callType = callType;
    this.isInitiator = false;

    console.log(`Incoming ${callType} call from ${from}`);

    // Show incoming call modal
    this.showIncomingCallModal(from, callType, async (accepted) => {
      if (accepted) {
        try {
          // Get user media
          const constraints = {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: callType === 'video' ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            } : false
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
            console.log(`Adding ${track.kind} track to peer connection`);
            this.peerConnection.addTrack(track, this.localStream);
          });

          // Set remote description first
          console.log('Setting remote description from offer');
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

          // Process any pending ICE candidates
          await this.processPendingIceCandidates();

          // Create answer
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          console.log('Local description set, sending answer');

          // Send answer
          this.socket.emit('call-answer', {
            to: from,
            answer: answer
          });

          // Set timeout for call connection
          this.setCallTimeout();

        } catch (error) {
          console.error('Error accepting call:', error);
          let errorMessage = 'Could not accept call: ';
          
          if (error.name === 'NotAllowedError') {
            errorMessage += 'Permission denied. Please allow camera/microphone access.';
          } else if (error.name === 'NotFoundError') {
            errorMessage += 'No camera/microphone found.';
          } else if (error.name === 'NotReadableError') {
            errorMessage += 'Camera/microphone is already in use.';
          } else {
            errorMessage += error.message;
          }
          
          alert(errorMessage);
          this.rejectCall();
        }
      } else {
        this.rejectCall();
      }
    });
  }

  async handleCallAnswered(data) {
    const { answer } = data;
    try {
      console.log('Received answer, setting remote description');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Process any pending ICE candidates
      await this.processPendingIceCandidates();
      
      this.updateCallStatus('Connecting...');
    } catch (error) {
      console.error('Error handling call answer:', error);
      this.endCall();
    }
  }

  async handleIceCandidate(data) {
    const { candidate } = data;
    
    if (!candidate) {
      console.log('Received null ICE candidate (end of candidates)');
      return;
    }

    console.log('Received ICE candidate');

    // If we don't have a peer connection or remote description yet, buffer the candidate
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      console.log('Buffering ICE candidate (no remote description yet)');
      this.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added successfully');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  async processPendingIceCandidates() {
    if (this.pendingIceCandidates.length === 0) return;

    console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
    
    for (const candidate of this.pendingIceCandidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('Pending ICE candidate added');
      } catch (error) {
        console.error('Error adding pending ICE candidate:', error);
      }
    }
    
    this.pendingIceCandidates = [];
  }

  createPeerConnection() {
    console.log('Creating peer connection');
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        this.socket.emit('ice-candidate', {
          to: this.currentCallRecipient,
          candidate: event.candidate
        });
      } else {
        console.log('ICE candidate gathering complete');
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
      
      switch (this.peerConnection.iceConnectionState) {
        case 'connected':
          this.updateCallStatus('Connected');
          this.connectionAttempts = 0;
          break;
        case 'disconnected':
          this.updateCallStatus('Reconnecting...');
          break;
        case 'failed':
          console.error('ICE connection failed');
          if (this.connectionAttempts < this.maxConnectionAttempts) {
            this.updateCallStatus('Connection failed, retrying...');
            setTimeout(() => this.restartIce(), 1000);
          } else {
            alert('Connection failed. Please try again.');
            this.endCall();
          }
          break;
        case 'closed':
          this.endCall();
          break;
      }
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log(`Received remote ${event.track.kind} track`);
      
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
        if (this.connectionAttempts < this.maxConnectionAttempts) {
          this.updateCallStatus('Connection lost, reconnecting...');
        }
      }
    };

    // Handle signaling state changes
    this.peerConnection.onsignalingstatechange = () => {
      console.log('Signaling state:', this.peerConnection.signalingState);
    };
  }

  async restartIce() {
    if (!this.peerConnection || !this.isInitiator) return;

    try {
      console.log('Restarting ICE...');
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      
      this.socket.emit('call-user', {
        to: this.currentCallRecipient,
        offer: offer,
        callType: this.callType
      });
    } catch (error) {
      console.error('Error restarting ICE:', error);
      this.endCall();
    }
  }

  setCallTimeout() {
    // Set a 30-second timeout for establishing connection
    this.callTimeout = setTimeout(() => {
      if (this.peerConnection && 
          this.peerConnection.iceConnectionState !== 'connected' &&
          this.peerConnection.iceConnectionState !== 'completed') {
        console.error('Call connection timeout');
        alert('Connection timeout. Please check your network and try again.');
        this.endCall();
      }
    }, 30000);
  }

  endCall() {
    console.log('Ending call');
    
    // Clear timeout
    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }

    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
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

    // Reset state
    this.currentCallRecipient = null;
    this.remoteStream = null;
    this.callType = null;
    this.pendingIceCandidates = [];
    this.isInitiator = false;
    this.connectionAttempts = 0;
  }

  rejectCall() {
    console.log('Rejecting call');
    if (this.currentCallRecipient) {
      this.socket.emit('reject-call', { to: this.currentCallRecipient });
    }
    this.hideIncomingCallModal();
    this.currentCallRecipient = null;
    this.pendingIceCandidates = [];
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
        console.log(`Audio ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
        return !audioTrack.enabled;
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log(`Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
        return !videoTrack.enabled;
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
    console.log('Call status:', status);
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