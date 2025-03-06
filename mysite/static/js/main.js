document.addEventListener('DOMContentLoaded', function() {
    console.log('Hello from main.js');

    var inputUsername = document.querySelector('#username');
    var btnJoin = document.querySelector('#btn-join');
    var localVideo = document.querySelector('#local-video');
    var btnToggleAudio = document.querySelector('#btn-toggle-audio');
    var btnToggleVideo = document.querySelector('#btn-toggle-video');
    var btnPredict = document.getElementById('btn-predict');
    var outputText = document.getElementById('output-text');
    var guideBox = document.getElementById('guide-box');
    var recordButton = document.getElementById('btn-record');
    var btnShareScreen = document.getElementById('btn-share-screen');

    var mapPeers = {};
    var username;
    var webSocket;
    var meetingId;

    // Google API
    const CLIENT_ID = '591484697551-u8ag6jl4829i0uaium0mktdecvj21m5i.apps.googleusercontent.com';
    const API_KEY = 'AIzaSyAZHa_rjbQqTCbQa8_4yrsvjBFlZsB5vDI';
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';

    let tokenClient;
    let gapiInited = false;
    let gisInited = false;

    function gapiLoaded() {
        gapi.load('client', initializeGapiClient);
    }

    async function initializeGapiClient() {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiInited = true;
        checkLoginStatus();
    }

    function gisLoaded() {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: handleAuthResponse,
        });
        gisInited = true;
        checkLoginStatus();
    }

    function checkLoginStatus() {
        if (gapiInited && gisInited) {
            if (localStorage.getItem('access_token')) {
                const loginBtn = document.getElementById('loginBtn');
                const logoutBtn = document.getElementById('logoutBtn');
                if (loginBtn && logoutBtn) {
                    loginBtn.style.display = 'none';
                    logoutBtn.style.display = 'block';
                    document.getElementById('status').innerText = 'User is already signed in.';
                }
            } else {
                const loginBtn = document.getElementById('loginBtn');
                const logoutBtn = document.getElementById('logoutBtn');
                if (loginBtn && logoutBtn) {
                    loginBtn.style.display = 'block';
                    logoutBtn.style.display = 'none';
                    document.getElementById('status').innerText = 'User is not signed in.';
                }
            }
        }
    }

    function signIn() {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }

    function handleAuthResponse(response) {
        if (response && response.access_token) {
            console.log('Access Token:', response.access_token);
            localStorage.setItem('access_token', response.access_token);
            checkLoginStatus();
            window.location.href = '/dashboard/';
        } else {
            console.error('Login failed');
        }
    }

    function signOut() {
        localStorage.removeItem('access_token');
        google.accounts.oauth2.revoke(localStorage.getItem('access_token'), () => {
            console.log('User signed out.');
            checkLoginStatus();
        });
    }

    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', signIn);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', signOut);
    }

    window.onload = function () {
        gapiLoaded();
        gisLoaded();
    };

    function generateMeetingId() {
        return 'meeting-' + Math.random().toString(36).substr(2, 9);
    }
    
    //JOIN MEETING
    if (btnJoin){
        btnJoin.addEventListener('click', function() {
            
            username = inputUsername.value;
            console.log('Username:', username);

            if (username == '') {
                return;
            }

            inputUsername.value = '';
            inputUsername.disabled = true;
            inputUsername.style.visibility = 'hidden';

            btnJoin.disabled = true;
            btnJoin.style.visibility = 'hidden';

            var labelUsername = document.querySelector('#username-label');
            labelUsername.innerHTML = username;

            var loc = window.location;
            var wsStart = 'ws://';

            if (loc.protocol == 'https:') {
                wsStart = 'wss://';
            }

            var endpoint = wsStart + loc.host + loc.pathname;
            console.log('Connecting to:', endpoint);

            webSocket = new WebSocket(endpoint);

            webSocket.addEventListener('open', function(e) {
                console.log('Connection opened:', e);
                sendSignal('new-peer', {});
                // Set the meetingId when the connection is opened
                meetingId = generateMeetingId();
                console.log('Meeting ID:', meetingId);
            });
            webSocket.addEventListener('message', webSocketOnMessage);
            webSocket.addEventListener('close', function(e) {
                console.log('Connection Closed!:', e);
            });
            webSocket.addEventListener('error', function(e) {
                console.log('Connection Error!:', e);
            });
        });
    }

    // WEBRTC Function
    function webSocketOnMessage(event) {
        var parsedData = JSON.parse(event.data);
        var peerUsername = parsedData['peer'];
        var action = parsedData['action'];

        if (username == peerUsername) {
            return;
        }

        var receiver_channel_name = parsedData['message']['receiver_channel_name'];

        if (action == 'new-peer') {
            createOfferer(peerUsername, receiver_channel_name);
            return;
        }

        if (action == 'new-offer') {
            var offer = parsedData['message']['sdp'];
            createAnswerer(offer, peerUsername, receiver_channel_name);
            return;
        }

        if (action == 'new-answer') {
            var answer = parsedData['message']['sdp'];
            var peer = mapPeers[peerUsername][0];
            peer.setRemoteDescription(answer);
            return;
        }

        if (action == 'screen-share') {
            // Set video berbagi layar sebagai video utama
            var remoteVideo = document.getElementById(`video-${peerUsername}`);
            if (remoteVideo) {
                remoteVideo.classList.add('spotlight');
            }
        }
    }

    // Media Devices
    if (localVideo) {
        var localStream = new MediaStream();
        const constraints = {
            video: true,
            audio: true
        };

        var userMedia = navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                localStream = stream;
                localVideo.srcObject = localStream;
                localVideo.muted = true;

                var audioTracks = stream.getAudioTracks();
                var videoTracks = stream.getVideoTracks();

                audioTracks[0].enabled = true;
                videoTracks[0].enabled = true;

                if (btnToggleAudio) {
                    btnToggleAudio.addEventListener('click', function() {
                        audioTracks[0].enabled = !audioTracks[0].enabled;
                        btnToggleAudio.innerHTML= `<i id="icon-audio" class="fas fa-microphone-slash text-red-400 text-2xl"></i>`;
                        
                        if (audioTracks[0].enabled) {
                            btnToggleAudio.innerHTML= `<i id="icon-audio" class="fas fa-microphone text-yellow-400 text-2xl"></i>`;
                            return;
                        }
                    });
                }

                if (btnToggleVideo) {
                    btnToggleVideo.addEventListener('click', function() {
                        videoTracks[0].enabled = !videoTracks[0].enabled;
                        btnToggleVideo.innerHTML= `<i id="icon-video" class="fas fa-video-slash text-red-400 text-2xl"></i>`;
                        
                        if (videoTracks[0].enabled) {
                            btnToggleVideo.innerHTML= `<i id="icon-video" class="fas fa-video text-green-400 text-2xl"></i>`;
                            return;
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Error accessing media devices.', error);
            });
    }


    // Chat
    var btnSendMsg= document.getElementById('btn-send-msg');
    var msgList= document.getElementById('message-list');
    var msgInput= document.getElementById('msg');

    btnSendMsg.addEventListener('click', sendMsgOnClick);

    function sendMsgOnClick() {
        var message= msgInput.value;
        var li= document.createElement('li');

        li.appendChild(document.createTextNode('Me: '+ message));
        msgList.appendChild(li);

        var dataChannels= getDataChannels();

        message= username+ ': '+ message;

        for(index in dataChannels) {
            dataChannels[index].send(message);
        }

        msgInput.value= '';
    }

    function sendSignal(action, message) {
        var jsonStr = JSON.stringify({
            'peer': username,
            'action': action,
            'message': message,
        });

        console.log("Sending data to WebSocket:", jsonStr);
        webSocket.send(jsonStr);
    }

    // Offer
    function createOfferer(peerUsername, receiver_channel_name) {
        var peer = new RTCPeerConnection(null);
        addLocalTracks(peer);

        var dc = peer.createDataChannel('channel');
        dc.addEventListener('open', function() {
            console.log('Connection opened!');
        });
        dc.addEventListener('message', dcOnMessage);

        var remoteVideo = createVideo(peerUsername);
        setOnTrack(peer, remoteVideo);

        mapPeers[peerUsername] = [peer, dc];

        peer.addEventListener('iceconnectionstatechange', () => {
            var iceConnectionState = peer.iceConnectionState;

            if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
                delete mapPeers[peerUsername];
                if (iceConnectionState !== 'closed') {
                    peer.close();
                }
                removeVideo(remoteVideo, peerUsername);
            }
        });

        peer.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
                console.log('New Ice Candidate:', JSON.stringify(peer.localDescription));
                return;
            }

            sendSignal('new-offer', {
                'sdp': peer.localDescription,
                'receiver_channel_name': receiver_channel_name
            });
        });

        peer.createOffer()
            .then(o => peer.setLocalDescription(o))
            .then(() => {
                console.log('Local Description set successfully!');
            });
    }

    // Answer
    function createAnswerer(offer, peerUsername, receiver_channel_name) {
        var peer = new RTCPeerConnection(null);
        addLocalTracks(peer);

        var remoteVideo = createVideo(peerUsername);
        setOnTrack(peer, remoteVideo);

        peer.addEventListener('datachannel', (e) => {
            peer.dc = e.channel;
            peer.dc.addEventListener('open', () => {
                console.log('Connection opened!');
            });
            peer.dc.addEventListener('message', dcOnMessage);

            mapPeers[peerUsername] = [peer, peer.dc];
        });

        peer.addEventListener('iceconnectionstatechange', () => {
            var iceConnectionState = peer.iceConnectionState;

            if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
                delete mapPeers[peerUsername];
                if (iceConnectionState !== 'closed') {
                    peer.close();
                }
                removeVideo(remoteVideo, peerUsername);
            }
        });

        peer.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
                console.log('New Ice Candidate:', JSON.stringify(peer.localDescription));
                return;
            }

            sendSignal('new-answer', {
                'sdp': peer.localDescription,
                'receiver_channel_name': receiver_channel_name
            });
        });

        peer.setRemoteDescription(offer)
            .then(() => {
                console.log('Remote Description set successfully for %s.', peerUsername);
                return peer.createAnswer();
            })
            .then(a => {
                console.log('Answer created!');
                peer.setLocalDescription(a);
            });
    }

    function addLocalTracks(peer) {
        localStream.getTracks().forEach(track => {
            peer.addTrack(track, localStream);
        });
        return;
    }

    var messageList = document.querySelector('#message-list');
    function dcOnMessage(event) {
        var message = event.data;

        var li = document.createElement('li');
        li.appendChild(document.createTextNode(message));
        messageList.appendChild(li);
    }

    function updateVideoLayout() {
        const videoContainer = document.getElementById('video-container');
        const remoteVideos = document.getElementById('remote-videos');
        const numVideos = remoteVideos.children.length + 1; // Including local video

        if (numVideos === 1) {
            videoContainer.style.gridTemplateColumns = '1fr';
            videoContainer.style.gridTemplateRows = '1fr';
            document.getElementById('local-video-wrapper').classList.add('fullscreen');
        } else {
            document.getElementById('local-video-wrapper').classList.remove('fullscreen');
            if (numVideos === 2) {
                videoContainer.style.gridTemplateColumns = '1fr 1fr';
                videoContainer.style.gridTemplateRows = '1fr';
            } else if (numVideos <= 4) {
                videoContainer.style.gridTemplateColumns = '1fr 1fr';
                videoContainer.style.gridTemplateRows = '1fr 1fr';
            } else {
                videoContainer.style.gridTemplateColumns = '1fr 1fr 1fr';
                videoContainer.style.gridTemplateRows = '1fr 1fr';
            }
        }
    }

    function createVideo(peerUsername) {
        let videoContainer = document.getElementById('remote-videos');

        let videoWrapper = document.createElement('div');
        videoWrapper.id = `video-wrapper-${peerUsername}`;
        videoWrapper.classList.add('video-wrapper');
        
        // Check if participant name already exists in video wrapper
        let usernameLabel = videoWrapper.querySelector('.participant-username');
        if (!usernameLabel) {
            // If not, create name element
            usernameLabel = document.createElement('div');
            usernameLabel.classList.add('participant-username');
            usernameLabel.textContent = peerUsername;
        }

        // Create video element
        let videoElement = document.createElement('video');
        videoElement.id = `video-${peerUsername}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.classList.add('remote-video');

        // Add username and video to video wrapper
        videoWrapper.appendChild(usernameLabel);
        videoWrapper.appendChild(videoElement);
        
        // Add video wrapper to container
        videoContainer.appendChild(videoWrapper);

        // Update layout and display
        addParticipantName(peerUsername);
        updateVideoLayout(); // Update layout every time a new video is added

        return videoElement;
    }

    function setOnTrack(peer, remoteVideo) {
        let remoteStream = new MediaStream();

        peer.addEventListener('track', async (event) => {
            remoteStream.addTrack(event.track);
            remoteVideo.srcObject = remoteStream;
        });
    }

    function removeVideo(video, peerUsername) {
        var videoWrapper = video.parentNode;
        videoWrapper.parentNode.removeChild(videoWrapper);

        // Remove participant name from the participants list
        removeParticipantName(peerUsername);

        updateVideoLayout(); // Update layout whenever a video is removed
    }

    function getDataChannels() {
        var dataChannels = [];
    
        for(peerUsername in mapPeers) {
            var dataChannel= mapPeers[peerUsername][1];
    
            dataChannels.push(dataChannel);
        }
    
        return dataChannels;
    }

    function addParticipantName(peerUsername) {
        const participantsList = document.getElementById('participants-list');
        
        // Check if element already exists based on participant ID
        if (!document.getElementById(`participant-${peerUsername}`)) {
            const participantItem = document.createElement('div');
            participantItem.id = `participant-${peerUsername}`;
            participantItem.classList.add('text-white');
            participantItem.textContent = peerUsername;
            participantsList.appendChild(participantItem);
        }
    }

    function removeParticipantName(peerUsername) {
        const participantItem = document.getElementById(`participant-${peerUsername}`);
        if (participantItem) {
            participantItem.parentNode.removeChild(participantItem);
        }
    }

    // SHARE SCREEN
    if (btnShareScreen) {
        btnShareScreen.addEventListener('click', async function() {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                handleScreenShare(screenStream);
            } catch (error) {
                console.error("Gagal mendapatkan akses berbagi layar:", error);
                alert("Gagal berbagi layar. Pastikan Anda memberi izin akses.");
            }
        });
    }

    function sendScreenShareSignal(screenStream) {
        for (let peerUsername in mapPeers) {
            let peer = mapPeers[peerUsername][0];
            let sender = peer.getSenders().find(s => s.track.kind === 'video');
            sender.replaceTrack(screenStream.getVideoTracks()[0]);
    
            // Kirim sinyal berbagi layar ke semua pengguna
            sendSignal('screen-share', { 'peer': username });
        }
    }

    function handleScreenShare(screenStream) {
        // Kirim stream berbagi layar ke semua pengguna yang terhubung
        sendScreenShareSignal(screenStream);

        // Tampilkan stream berbagi layar di video lokal
        localVideo.srcObject = screenStream;

        // Hentikan berbagi layar saat pengguna berhenti berbagi
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
            // Kembalikan stream video asli
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    localStream = stream;
                    localVideo.srcObject = localStream;

                    for (let peerUsername in mapPeers) {
                        let peer = mapPeers[peerUsername][0];
                        let sender = peer.getSenders().find(s => s.track.kind === 'video');
                        sender.replaceTrack(localStream.getVideoTracks()[0]);
                    }
                })
                .catch(error => {
                    console.error("Gagal mengembalikan stream video asli:", error);
                });
        });
    }


    // RECORDING MEETING
    if (recordButton) {
        let mediaRecorder;
        let recordedChunks = [];
        let stream;

        recordButton.addEventListener('click', async function() {
            console.log("Tombol record diklik");

            if (mediaRecorder && mediaRecorder.state === 'recording') {
                console.log("Menghentikan rekaman...");
                mediaRecorder.stop();
                recordButton.innerHTML = '<i class="fas fa-record-vinyl text-red-400 text-2xl"></i>';
            } else {
                console.log("Memulai rekaman...");
                await startRecording();
                recordButton.innerHTML = '<i class="fas fa-stop text-red-400 text-2xl"></i>';
            }
        });

        async function startRecording() {
            try {
                console.log("Meminta akses rekaman layar...");
                stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                console.log("Akses diberikan, mulai merekam...");

                let options = { mimeType: 'video/webm; codecs=vp9' };
                recordedChunks = [];
                mediaRecorder = new MediaRecorder(stream, options);

                mediaRecorder.ondataavailable = function(event) {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                        console.log("Data rekaman tersedia.");
                    }
                };

                mediaRecorder.onstop = function() {
                    console.log("Rekaman selesai, menyimpan ke perangkat...");
                    let blob = new Blob(recordedChunks, { type: 'video/webm' });
                    console.log('Meeting ID:', meetingId);
                    saveToLocal(blob, meetingId);
                };

                mediaRecorder.start();
                console.log("MediaRecorder dimulai.");
            } catch (error) {
                console.error("Gagal mendapatkan akses media:", error);
                alert("Gagal merekam layar. Pastikan Anda memberi izin akses.");
            }
        }


        function saveToLocal(blob, meetingId) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Meeting Recording ${meetingId}.webm`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        }

        window.onload = function () {
            gapiLoaded();
            gisLoaded();
        };
    }
 

    // Sign Language Prediction
    if (btnPredict && outputText && guideBox) {
        let model;
        const classLabels = [
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 
            'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
            'SPACE', 'DELETE', 'NOTHING'
        ];
        isPredicting = false;
        btnPredict = document.getElementById('btn-predict');
        outputText= document.getElementById('output-text');
        guideBox= document.getElementById('guide-box');

        // Load the model
        async function loadModel() {
            try {
                model = await tf.loadLayersModel("/./static/model/model.json"); // Path to your TensorFlow.js model
                console.log("Model loaded successfully!");
            } catch (error) {
                console.error("Error loading model:", error);
            }
        }

        // Preprocess video frame for prediction
        function preprocessFrame(videoElement) {
            const canvas = document.createElement('canvas');
            canvas.width = 224; // Match model input size
            canvas.height = 224;
            const ctx = canvas.getContext('2d');
            const boxRect = guideBox.getBoundingClientRect();
            const videoRect = localVideo.getBoundingClientRect();
            // Hitung rasio perbedaan antara ukuran tampilan video dan ukuran asli
            const scaleX = videoElement.videoWidth / videoRect.width;
            const scaleY = videoElement.videoHeight / videoRect.height;
            // Hitung koordinat dalam skala video asli
            const x = (boxRect.left - videoRect.left) * scaleX;
            const y = (boxRect.top - videoRect.top) * scaleY;
            const width = boxRect.width * scaleX;
            const height = boxRect.height * scaleY;
            ctx.drawImage(videoElement, x, y, width, height, 0, 0, canvas.width, canvas.height);
            let imageData = tf.browser.fromPixels(canvas);
            imageData = imageData.expandDims(0); // Add batch dimension
            imageData = imageData.toFloat().div(127.5).sub(1); // Normalize to [-1, 1] (for MobileNetV2)
            return imageData;
        }

        // Make predictions
        async function predictSignLanguage() {
            try {
                if (model && localVideo.readyState >= 2) {
                    tf.engine().startScope();

                    const inputTensor = preprocessFrame(localVideo);
                    const prediction = await model.predict(inputTensor);
                    const classIndex = prediction.argMax(1).dataSync()[0];
                    const predictedLabel = classLabels[classIndex];
                    outputText.innerText = `Prediction: ${predictedLabel}`;
                    tf.dispose(inputTensor); // Dispose tensors to free memory
                    tf.dispose(prediction);
                }
            } catch (error) {
                console.error("Error during prediction:", error);
            }
        }

        // Function to toggle prediction on/off
        async function togglePrediction() {
            // Function to toggle prediction on/off
            let predictionTimeout; // Variabel untuk menyimpan timeout prediksi
            if (!isPredicting) {
                // Mulai prediksi
                await loadModel();
                isPredicting = true;
                console.log("Prediction started...");
                btnPredict.innerHTML = '<i class="fas fa-hand text-white text-2xl"></i>';
                guideBox.style.visibility = 'visible';
                const predictLoop = async () => {
                    if (!isPredicting) return; // Stop if prediction is turned
                    await predictSignLanguage(); // Wait until prediction is finished
                    predictionTimeout= setTimeout(predictLoop, 200); // Call predict again after 200ms
                };
                predictLoop();
            } else {
                // Hentikan prediksi
                isPredicting = false;
                outputText.innerText = "Prediction: -";
                btnPredict.innerHTML = '<i class="fas fa-hand text-grey text-2xl"></i>';
                guideBox.style.visibility = 'hidden';
                console.log("Prediction stopped.");
                clearTimeout(predictionTimeout);
                // Hapus model dari memori dengan aman
                if (model) {
                    model.dispose();
                    model = null;
                }

                // Hapus semua tensor aktif
                tf.engine().endScope();
            }
        }

        btnPredict.addEventListener('click', togglePrediction);
    }
});
