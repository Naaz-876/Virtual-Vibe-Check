import './style.css';

import firebase from 'firebase/app';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDBdscWiu6dcCze26bZAuFmaplA77hYxo0",
  authDomain: "emoo-e0a56.firebaseapp.com",
  projectId: "emoo-e0a56",
  storageBucket: "emoo-e0a56.appspot.com",
  messagingSenderId: "230461419359",
  appId: "1:230461419359:web:3985808d41f6b3309950ea",
  measurementId: "G-49PDVDQ07X"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

// 1. Setup media sources

webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// Function to stop the camera stream
const offCamera = async () => {
  // Stop the local media stream
  if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
  }
  
  // Stop displaying the local stream
  webcamVideo.srcObject = null;

  // Reset the remote stream
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  // Disable call, answer, and off camera buttons
  callButton.disabled = true;
  answerButton.disabled = true;
  webcamButton.disabled = false;
};

// Assign offCamera function to the onclick event of the Off Camera button
offCameraButton.onclick = offCamera;

// 2. Create an offer
callButton.onclick = async () => {
  // Reference Firestore collections for signaling
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  // Listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};
// 4. Hang up the call
// Function to hang up the call on both local and remote sides
const hangupCall = async (callId) => {
  // Close peer connection
  pc.close();

  // Reset streams
  webcamVideo.srcObject = null;
  remoteVideo.srcObject = null;

  // Disable hangup button
  hangupButton.disabled = true;

  // Enable other buttons
  webcamButton.disabled = false;
  callButton.disabled = true;
  answerButton.disabled = true;

  // Access the Firestore document for the call
  const callDoc = firestore.collection('calls').doc(callId);

  // Update the call document to indicate call has ended
  await callDoc.update({ ended: true });
};

// Hang up the call when the "Hangup" button is clicked
hangupButton.onclick = () => {
  // Get the call ID
  const callId = callInput.value;

  // Call the hangup function
  hangupCall(callId);
};



