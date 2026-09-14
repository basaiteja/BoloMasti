"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function FeatureCheck() {
  const [user, setUser] = useState(null), [messages, setMessages] = useState([]), [text, setText] = useState(""), [camera, setCamera] = useState(false), [note, setNote] = useState("");
  const streamRef = useRef(null), videoRef = useRef(null);
  useEffect(() => auth ? onAuthStateChanged(auth, setUser) : undefined, []);
  useEffect(() => {
    if (!user) return;
    const room = doc(db, "conversations", `test_${user.uid}`);
    setDoc(room, { members: [user.uid], participantInfo: { [user.uid]: { name: "My test room" } }, updatedAt: serverTimestamp() }, { merge: true });
    return onSnapshot(query(collection(room, "messages"), orderBy("createdAt", "asc")), snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);
  const testMessage = async (e) => { e.preventDefault(); if (!text.trim()) return; const room = doc(db, "conversations", `test_${user.uid}`); await addDoc(collection(room, "messages"), { text: text.trim(), senderId: user.uid, type: "test", createdAt: serverTimestamp() }); setText(""); setNote("Message delivered to your private test room."); };
  const testCamera = async () => { try { streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); videoRef.current.srcObject = streamRef.current; setCamera(true); setNote("Camera and microphone are working."); } catch { setNote("Camera or microphone permission was denied."); } };
  const stopCamera = () => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; setCamera(false); };
  if (!user) return <main className="check-page"><h1>Sign in first</h1><p>Use your BoloMasti account before running feature checks.</p><a className="primary" href="/connect">Go to sign in</a></main>;
  return <main className="check-page"><a className="brand" href="/connect">bolo<em>masti</em><b>.</b></a><p className="tag">FEATURE CHECKS</p><h1>Test your <em>app.</em></h1><p className="lead">These checks use your real Firebase account but create a private test conversation visible only to you.</p><section className="check-card"><div><h2>Messages</h2><p>Send a test message and confirm it appears below in real time.</p></div><div className="test-messages">{messages.length ? messages.map(m => <p key={m.id}>{m.text}</p>) : <small>No test messages yet.</small>}</div><form onSubmit={testMessage}><input value={text} onChange={e=>setText(e.target.value)} placeholder="Type a test message" /><button className="primary">Send test</button></form></section><section className="check-card"><div><h2>Video call permissions</h2><p>Checks whether this device can access your camera and microphone. Allow both permissions when prompted.</p></div>{camera && <video ref={videoRef} autoPlay muted playsInline className="test-video" />}{camera ? <button className="secondary" onClick={stopCamera}>Stop camera test</button> : <button className="primary" onClick={testCamera}>Test camera & microphone</button>}</section>{note && <p className="check-note">{note}</p>}<a className="back-link" href="/connect">← Back to BoloMasti</a></main>;
}
