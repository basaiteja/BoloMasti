"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RecaptchaVerifier, createUserWithEmailAndPassword, onAuthStateChanged, reload, sendEmailVerification, signInWithEmailAndPassword, signInWithPhoneNumber, signOut } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, firebaseReady, storage } from "../../lib/firebase";
import "./connect.css";

const interests = ["Music", "Movies", "Gaming", "Food", "Travel", "Books", "Fitness", "Art", "Memes", "Tech"];
const languages = ["Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Odia", "English"];
const gamePrompts = ["Would you rather explore the mountains or the beach?", "What song can always lift your mood?", "Pick one: chai with friends or a late-night drive?", "What is a small thing that made you smile this week?", "Two truths and a lie: send yours and let your friend guess!"];
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function PostCard({ post, user, profile, followingIds, onToggleFollow }) {
  const [likes, setLikes] = useState(0), [liked, setLiked] = useState(false), [comments, setComments] = useState([]), [comment, setComment] = useState(""), [showComments, setShowComments] = useState(false);
  useEffect(() => {
    const stopLikes = onSnapshot(collection(db, "posts", post.id, "likes"), snapshot => {
      setLikes(snapshot.size);
      setLiked(snapshot.docs.some(item => item.id === user.uid));
    });
    const stopComments = onSnapshot(query(collection(db, "posts", post.id, "comments"), limit(100)), snapshot => {
      const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      items.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      setComments(items);
    });
    return () => { stopLikes(); stopComments(); };
  }, [post.id, user.uid]);
  const toggleLike = async () => {
    const likeRef = doc(db, "posts", post.id, "likes", user.uid);
    if (liked) await deleteDoc(likeRef);
    else await setDoc(likeRef, { uid: user.uid, name: profile?.name || "Friend", createdAt: serverTimestamp() });
  };
  const sendComment = async event => {
    event.preventDefault();
    const value = comment.trim();
    if (!value) return;
    await addDoc(collection(db, "posts", post.id, "comments"), { authorId: user.uid, authorName: profile?.name || "Friend", text: value.slice(0, 500), createdAt: serverTimestamp() });
    setComment("");
    setShowComments(true);
  };
  return <article className="social-post"><header className="social-post-header"><div className="mini-avatar">{post.authorName?.[0] || "F"}</div><div><b>{post.authorName || "Friend"}</b><small>{post.createdAt?.toDate?.().toLocaleDateString?.() || "Recently"}</small></div>{post.authorId !== user.uid && <button className={followingIds.includes(post.authorId) ? "follow-button following" : "follow-button"} onClick={() => onToggleFollow({ uid: post.authorId, name: post.authorName, photoURL: post.authorPhotoURL || "" })}>{followingIds.includes(post.authorId) ? "Following" : "Follow"}</button>}</header><img className="social-post-photo" src={post.photoURL} alt={post.caption || `${post.authorName || "Friend"}'s photo`}/>{post.caption && <p className="social-caption">{post.caption}</p>}<div className="post-actions"><button className={liked ? "liked" : ""} onClick={toggleLike}>{liked ? "♥" : "♡"} {likes} {likes === 1 ? "like" : "likes"}</button><button onClick={() => setShowComments(value => !value)}>◌ {comments.length} {comments.length === 1 ? "comment" : "comments"}</button></div>{showComments && <div className="post-comments">{comments.map(item => <p key={item.id}><b>{item.authorName || "Friend"}</b> {item.text}</p>)}<form onSubmit={sendComment}><input value={comment} onChange={event => setComment(event.target.value)} placeholder="Write a comment…" maxLength={500}/><button type="submit" disabled={!comment.trim()}>Send</button></form></div>}</article>;
}

export default function Connect() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null), [profile, setProfile] = useState(null), [view, setView] = useState("loading"), [conversations, setConversations] = useState([]), [callLogs, setCallLogs] = useState([]), [posts, setPosts] = useState([]), [feedPosts, setFeedPosts] = useState([]), [suggestedUsers, setSuggestedUsers] = useState([]), [followingIds, setFollowingIds] = useState([]), [followers, setFollowers] = useState([]), [following, setFollowing] = useState([]), [followList, setFollowList] = useState(null), [returnView, setReturnView] = useState("lobby");
  const [form, setForm] = useState({ name: "", bio: "", gender: "", interestedIn: [], language: "", interests: [] });
  const [groupTitle, setGroupTitle] = useState("New friend circle"), [groupInvitees, setGroupInvitees] = useState([]), [gamePrompt, setGamePrompt] = useState(gamePrompts[0]), [gameChat, setGameChat] = useState("");
  const [authMode, setAuthMode] = useState("signin"), [loginMethod, setLoginMethod] = useState("email"), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [phone, setPhone] = useState(""), [otp, setOtp] = useState(""), [otpSent, setOtpSent] = useState(false), [authBusy, setAuthBusy] = useState(false), [verificationError, setVerificationError] = useState("");
  const [match, setMatch] = useState(null), [messages, setMessages] = useState([]), [text, setText] = useState(""), [postCaption, setPostCaption] = useState(""), [publishingPost, setPublishingPost] = useState(false);
  const [notice, setNotice] = useState(""), [reporting, setReporting] = useState(false), [call, setCall] = useState(false), [callType, setCallType] = useState("video"), [incomingCall, setIncomingCall] = useState(false);
  const queueRef = useRef(null), unsubMessages = useRef(null), peer = useRef(null), localVideo = useRef(null), remoteVideo = useRef(null), remoteAudio = useRef(null), localStream = useRef(null), remoteStream = useRef(null), recaptcha = useRef(null), phoneConfirmation = useRef(null), callLogRef = useRef(null);

  const say = (value) => { setNotice(value); setTimeout(() => setNotice(""), 3500); };
  const Toast = () => notice ? <div className="toast">{notice}</div> : null;
  useEffect(() => {
    if (!firebaseReady || !auth) { setView("setup"); return; }
    return onAuthStateChanged(auth, async (next) => {
      setUser(next || null);
      if (!next) {
        setView("welcome");
        if (pathname === "/connect") router.replace("/login");
        return;
      }
      if (pathname === "/login") router.replace("/connect");
      if (next.providerData.some(p => p.providerId === "password") && !next.emailVerified) return setView("verifyEmail");
      try {
        const snap = await getDoc(doc(db, "users", next.uid));
        if (snap.exists()) {
          const saved = snap.data();
          setProfile(saved);
          if (!saved.gender || !Array.isArray(saved.interestedIn) || !saved.interestedIn.length || !saved.language) {
            setForm(f => ({ ...f, name: saved.name || "", bio: saved.bio || "", gender: saved.gender || "", interestedIn: saved.interestedIn || [], language: saved.language || "", interests: saved.interests || [] }));
            setView("profile");
          } else setView("lobby");
        } else setView("profile");
      } catch (error) {
        console.error("BoloMasti profile read failed", error);
        setView("firestoreError");
      }
    });
  }, [pathname, router]);
  useEffect(() => {
    if (!user) { setConversations([]); return; }
    return onSnapshot(query(collection(db, "conversations"), where("members", "array-contains", user.uid), limit(50)), snapshot => {
      const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      items.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      setConversations(items);
    }, error => { console.error("BoloMasti conversations could not load", error); say("Your chats could not load. Check Firestore access and try again."); });
  }, [user]);
  useEffect(() => {
    if (!user) { setCallLogs([]); setPosts([]); return; }
    const stopCalls = onSnapshot(query(collection(db, "callLogs", user.uid, "items"), limit(100)), snapshot => {
      const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setCallLogs(items);
    }, error => console.error("BoloMasti call history could not load", error));
    const stopPosts = onSnapshot(query(collection(db, "posts"), where("authorId", "==", user.uid), limit(50)), snapshot => {
      const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setPosts(items);
    }, error => console.error("BoloMasti posts could not load", error));
    const stopFeed = onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)), snapshot => {
      const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => item.photoURL);
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setFeedPosts(items);
    }, error => console.error("BoloMasti community feed could not load", error));
    const stopUsers = onSnapshot(query(collection(db, "users"), limit(50)), snapshot => {
      setSuggestedUsers(snapshot.docs.map(item => ({ uid: item.id, ...item.data() })).filter(item => item.uid !== user.uid && item.name));
    }, error => console.error("BoloMasti people suggestions could not load", error));
    const stopFollowing = onSnapshot(collection(db, "users", user.uid, "following"), snapshot => { const rows = snapshot.docs.map(item => ({ uid: item.id, ...item.data() })); setFollowing(rows); setFollowingIds(rows.map(item => item.uid)); });
    const stopFollowers = onSnapshot(collection(db, "users", user.uid, "followers"), snapshot => setFollowers(snapshot.docs.map(item => ({ uid: item.id, ...item.data() }))));
    return () => { stopCalls(); stopPosts(); stopFeed(); stopUsers(); stopFollowing(); stopFollowers(); };
  }, [user]);
  useEffect(() => () => { queueRef.current?.(); unsubMessages.current?.(); peer.current?.close(); }, []);
  useEffect(() => {
    if (!match) return;
    return onSnapshot(doc(db, "calls", match.id), snap => {
      const data = snap.data();
      if (data?.offer && !data.answer && data.calleeId === user.uid) {
        setCallType(data.type || "video");
        setIncomingCall(true);
      }
    });
  }, [match, user]);
  useEffect(() => {
    if (!call) return;
    if (callType === "video") {
      if (localVideo.current && localStream.current) localVideo.current.srcObject = localStream.current;
      if (remoteVideo.current && remoteStream.current) remoteVideo.current.srcObject = remoteStream.current;
    } else if (remoteAudio.current && remoteStream.current) remoteAudio.current.srcObject = remoteStream.current;
  }, [call, callType]);

  const verificationSettings = () => ({ url: `${window.location.origin}/connect`, handleCodeInApp: false });
  const emailLogin = async (e) => { e.preventDefault(); if (!email || password.length < 6) return say("Enter an email and a password with at least 6 characters."); setAuthBusy(true); setVerificationError(""); try { if (authMode === "signup") { const credential = await createUserWithEmailAndPassword(auth, email, password); await sendEmailVerification(credential.user, verificationSettings()); say("We sent a verification link to your email."); } else await signInWithEmailAndPassword(auth, email, password); } catch (error) { console.error("BoloMasti authentication error", error); const messages = { "auth/email-already-in-use": "This email already has an account. Try signing in.", "auth/invalid-credential": "Email or password is incorrect.", "auth/weak-password": "Use a password with at least 6 characters.", "auth/unauthorized-continue-uri": "Add bolomasti.netlify.app to Firebase Authentication → Settings → Authorized domains." }; const message = messages[error.code] || `Firebase could not send the verification email (${error.code || "unknown error"}).`; setVerificationError(message); say(message); } finally { setAuthBusy(false); } };
  const resendVerification = async () => { try { setVerificationError(""); await sendEmailVerification(auth.currentUser, verificationSettings()); say("A new verification link has been sent."); } catch (error) { console.error("BoloMasti verification email error", error); const message = error.code === "auth/unauthorized-continue-uri" ? "Add bolomasti.netlify.app to Firebase Authentication → Settings → Authorized domains." : `Firebase could not resend the email (${error.code || "unknown error"}).`; setVerificationError(message); say(message); } };
  const finishVerification = async () => { await reload(auth.currentUser); if (!auth.currentUser.emailVerified) return say("Your email is not verified yet. Open the link we sent first."); setView("profile"); };
  const sendOtp = async (e) => { e.preventDefault(); if (!/^\+[1-9]\d{7,14}$/.test(phone)) return say("Use your full number with country code, for example +919876543210."); setAuthBusy(true); try { if (!recaptcha.current) recaptcha.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" }); phoneConfirmation.current = await signInWithPhoneNumber(auth, phone, recaptcha.current); setOtpSent(true); say("Verification code sent."); } catch (error) { recaptcha.current?.clear(); recaptcha.current = null; say(error.code === "auth/operation-not-allowed" ? "Enable Phone in Firebase Authentication first." : "We couldn’t send a code. Check the number and try again."); } finally { setAuthBusy(false); } };
  const verifyOtp = async (e) => { e.preventDefault(); if (otp.length !== 6) return say("Enter the 6-digit verification code."); setAuthBusy(true); try { await phoneConfirmation.current.confirm(otp); } catch { say("That code is invalid or has expired. Please try again."); } finally { setAuthBusy(false); } };
  const saveProfile = async (e) => {
    e.preventDefault(); if (!form.name.trim() || !form.gender || !form.interestedIn.length || !form.language || !form.interests.length) return say("Add your name, gender, language, who you want to meet, and at least one interest.");
    const data = { uid: user.uid, name: form.name.trim(), bio: form.bio.trim(), gender: form.gender, interestedIn: form.interestedIn, language: form.language, interests: form.interests, photoURL: user.photoURL || profile?.photoURL || "", createdAt: profile?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() };
    try {
      await setDoc(doc(db, "users", user.uid), data, { merge: true });
      setProfile({ ...data, createdAt: new Date() }); setView(returnView || "lobby"); setReturnView("lobby");
    } catch (error) {
      console.error("BoloMasti profile write failed", error);
      say(error.code === "permission-denied" ? "Firestore denied the profile save. Check the published Firestore rules for this Firebase project." : "Could not save your profile. Check your connection and try again.");
    }
  };
  const toggleInterest = (value) => setForm(f => ({ ...f, interests: f.interests.includes(value) ? f.interests.filter(i => i !== value) : [...f.interests, value] }));
  const togglePreference = (value) => setForm(f => ({ ...f, interestedIn: f.interestedIn.includes(value) ? f.interestedIn.filter(i => i !== value) : [...f.interestedIn, value] }));
  const editProfile = () => { setReturnView(view === "profile" ? "lobby" : view); setForm({ name: profile?.name || "", bio: profile?.bio || "", gender: profile?.gender || "", interestedIn: profile?.interestedIn || [], language: profile?.language || "", interests: profile?.interests || [] }); setView("profile"); };
  const toggleFollow = async (person) => {
    if (!person?.uid || person.uid === user.uid) return;
    const ownFollowing = doc(db, "users", user.uid, "following", person.uid);
    const theirFollower = doc(db, "users", person.uid, "followers", user.uid);
    try {
      if (followingIds.includes(person.uid)) {
        await Promise.all([deleteDoc(ownFollowing), deleteDoc(theirFollower)]);
      } else {
        const myInfo = { uid: user.uid, name: profile?.name || "Friend", photoURL: profile?.photoURL || "" };
        const theirInfo = { uid: person.uid, name: person.name || "Friend", photoURL: person.photoURL || "" };
        await setDoc(ownFollowing, { ...theirInfo, createdAt: serverTimestamp() });
        await setDoc(theirFollower, { ...myInfo, createdAt: serverTimestamp() });
      }
    } catch (error) {
      console.error("BoloMasti follow update failed", error);
      say("Could not update this follow. Check the published Firestore rules.");
    }
  };
  const publishPhoto = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.photo.files?.[0];
    if (!file) return say("Choose a photo to publish.");
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return say("Choose an image smaller than 10 MB.");
    setPublishingPost(true);
    try {
      const location = ref(storage, `user-posts/${user.uid}/${Date.now()}-${file.name}`);
      await uploadBytes(location, file);
      const photoURL = await getDownloadURL(location);
      await addDoc(collection(db, "posts"), { authorId: user.uid, authorName: profile.name, photoURL, caption: postCaption.trim().slice(0, 300), createdAt: serverTimestamp() });
      setPostCaption("");
      form.reset();
      say("Your photo is published on your profile.");
    } catch (error) {
      console.error("BoloMasti photo post failed", error);
      say("Could not publish this photo. Check Firestore and Storage rules.");
    } finally { setPublishingPost(false); }
  };
  const leaveQueue = async () => { queueRef.current?.(); queueRef.current = null; await setDoc(doc(db, "matchQueue", user.uid), { status: "left", updatedAt: serverTimestamp() }, { merge: true }); setView("lobby"); };
  const startMatching = async () => {
    if (!profile?.gender || !profile?.interestedIn?.length || !profile?.language) { setView("profile"); return say("Add your gender, language, and who you want to meet before matching."); }
    setView("matching");
    try {
      await setDoc(doc(db, "matchQueue", user.uid), { uid: user.uid, name: profile.name, gender: profile.gender, interestedIn: profile.interestedIn, language: profile.language, interests: profile.interests, photoURL: profile.photoURL || "", status: "waiting", updatedAt: serverTimestamp() });
      const candidates = await getDocs(query(collection(db, "matchQueue"), where("status", "==", "waiting"), limit(12)));
      const other = candidates.docs.filter(d => {
        if (d.id === user.uid || profile.blocked?.includes(d.id)) return false;
        const candidate = d.data();
        return candidate.language === profile.language && (profile.interestedIn.includes(candidate.gender) || profile.interestedIn.includes("everyone")) && (candidate.interestedIn?.includes(profile.gender) || candidate.interestedIn?.includes("everyone"));
      }).sort((a, b) => {
        const shared = candidate => profile.interests.filter(interest => candidate.data().interests?.includes(interest)).length;
        return shared(b) - shared(a);
      })[0];
      if (other) { await openMatch(other.id, other.data()); return; }
      queueRef.current = onSnapshot(doc(db, "matchQueue", user.uid), async snap => { const data = snap.data(); if (data?.matchId) { queueRef.current?.(); await openConversation(data.matchId); } });
    } catch { queueRef.current?.(); queueRef.current = null; await setDoc(doc(db, "matchQueue", user.uid), { status: "left", updatedAt: serverTimestamp() }, { merge: true }); say("Matching is unavailable until Firestore is enabled and its rules are published."); setView("lobby"); }
  };
  const openMatch = async (otherUid, other) => {
    const ids = [user.uid, otherUid].sort(), id = ids.join("_");
    await setDoc(doc(db, "conversations", id), { members: ids, participantInfo: { [user.uid]: { name: profile.name, photoURL: profile.photoURL || "" }, [otherUid]: { name: other.name, photoURL: other.photoURL || "" } }, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
    await updateDoc(doc(db, "matchQueue", otherUid), { status: "matched", matchId: id });
    await setDoc(doc(db, "matchQueue", user.uid), { status: "matched", matchId: id }, { merge: true }); await openConversation(id);
  };
  const openConversation = async (id) => {
    const snap = await getDoc(doc(db, "conversations", id)), data = snap.data();
    const otherId = data.members.find(uid => uid !== user.uid), otherInfo = data.participantInfo?.[otherId];
    setMatch({ id, otherId, ...data, name: data.title || otherInfo?.name || "New friend" });
    setView("chat");
    setMessages([]);
    unsubMessages.current?.();
    unsubMessages.current = onSnapshot(query(collection(db, "conversations", id, "messages"), orderBy("createdAt", "asc")), snapshot => setMessages(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))));
  };
  const toggleGroupInvite = (uid) => setGroupInvitees(current => current.includes(uid) ? current.filter(item => item !== uid) : [...current, uid]);
  const createGroupRoom = async (event) => {
    event.preventDefault();
    const invitees = [...new Set(groupInvitees)];
    if (!invitees.length) return say("Choose at least one friend for your group room.");
    const members = [user.uid, ...invitees], participantInfo = { [user.uid]: { name: profile.name, photoURL: profile.photoURL || "" } };
    for (const uid of invitees) {
      const existing = conversations.find(item => item.participantInfo?.[uid]);
      participantInfo[uid] = existing?.participantInfo?.[uid] || { name: "Friend", photoURL: "" };
    }
    const room = doc(collection(db, "conversations"));
    try {
      await setDoc(room, { title: groupTitle.trim() || "New friend circle", kind: "group", createdBy: user.uid, members, participantInfo, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setGroupInvitees([]);
      await openConversation(room.id);
    } catch (error) {
      console.error("BoloMasti group room creation failed", error);
      say("Could not create this room. Check Firestore rules and try again.");
    }
  };
  const sendGameInvite = async (event) => {
    event.preventDefault();
    if (!gameChat) return say("Choose a friend to send the game to.");
    const conversation = conversations.find(item => item.id === gameChat);
    if (!conversation) return;
    await addDoc(collection(db, "conversations", conversation.id, "messages"), { text: `🎲 Quick game: ${gamePrompt}`, senderId: user.uid, type: "game", createdAt: serverTimestamp() });
    await updateDoc(doc(db, "conversations", conversation.id), { updatedAt: serverTimestamp(), lastMessage: `🎲 Quick game: ${gamePrompt}` });
    await openConversation(conversation.id);
  };
  const renderConversationList = (mode) => {
    const isCalls = mode === "calls", isRooms = mode === "rooms";
    const items = conversations.filter(item => isRooms ? item.members?.length > 2 : isCalls ? item.members?.length === 2 : true);
    const title = isCalls ? "Calls" : isRooms ? "Friend circles" : "Your conversations";
  };
  const renderCallHistory = () => <section className="call-history"><div className="section-title"><div><p className="tag">RECENT ACTIVITY</p><h2>Call history</h2></div></div>{callLogs.length ? <div className="conversation-list">{callLogs.map(log => <article className="conversation-card call-log-card" key={log.id}><div className="call-log-main"><span className="avatar">{log.otherName?.[0] || "F"}</span><span className="conversation-copy"><b>{log.otherName || "Friend"}</b><small>{log.type === "video" ? "◉ Video call" : "☎ Audio call"} · {log.direction === "outgoing" ? "Outgoing" : "Incoming"} · {log.createdAt?.toDate?.().toLocaleString?.() || "Just now"}</small></span></div><button className="call-back" onClick={()=>{const conversation=conversations.find(item=>item.id===log.conversationId); if(conversation) callConversation(conversation,log.type); else say("This conversation is no longer available.");}}>{log.type === "video" ? "Video" : "Audio"}</button></article>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon">☎</div><h2>No calls yet</h2><p>Audio and video calls with your friends will appear here.</p></div>}{renderConversationList("calls")}</section>;
  const renderFeed = () => <div className="social-feed"><section className="people-strip"><div className="section-title"><div><p className="tag">MEET YOUR COMMUNITY</p><h2>People to follow</h2></div></div><div className="people-scroll">{suggestedUsers.filter(person => !followingIds.includes(person.uid)).slice(0,12).map(person=><article className="person-suggestion" key={person.uid}><div className="mini-avatar">{person.name?.[0] || "F"}</div><b>{person.name}</b><small>{person.language || "BoloMasti member"}</small><button className="follow-button" onClick={()=>toggleFollow(person)}>Follow</button></article>)}</div></section><section><div className="section-title"><div><p className="tag">FROM THE COMMUNITY</p><h2>Photo posts</h2></div></div>{feedPosts.length ? <div className="social-post-list">{feedPosts.map(post=><PostCard key={post.id} post={post} user={user} profile={profile} followingIds={followingIds} onToggleFollow={toggleFollow}/>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon">▧</div><h2>Be the first to share</h2><p>Publish a photo from your Profile and it will appear in the community feed.</p><button className="primary" onClick={()=>setView("myProfile")}>Create a post</button></div>}</section></div>;
  const renderMyProfile = () => <div className="list-page profile-page"><div className="profile-hero"><div className="profile-avatar">{profile?.photoURL ? <img src={profile.photoURL} alt="Your profile"/> : <span>{profile?.name?.[0] || "B"}</span>}</div><div><p className="tag">YOUR PROFILE</p><h1>{profile?.name}</h1><p>{profile?.bio || `${profile?.language} · ${profile?.interests?.slice(0,3).join(" · ")}`}</p></div><button className="secondary" onClick={editProfile}>Edit profile</button></div><div className="profile-stats"><button onClick={()=>setFollowList({title:"Followers",items:followers})}><b>{followers.length}</b><span>Followers</span></button><button onClick={()=>setFollowList({title:"Following",items:following})}><b>{following.length}</b><span>Following</span></button><div><b>{posts.length}</b><span>Posts</span></div></div><form className="publish-card" onSubmit={publishPhoto}><div><p className="tag">SHARE A MOMENT</p><h2>Post a photo</h2></div><label className="photo-picker">＋ Add photo<input name="photo" type="file" accept="image/*" required/></label><textarea value={postCaption} onChange={event=>setPostCaption(event.target.value)} maxLength={300} placeholder="Write a caption…"/><button className="primary" type="submit" disabled={publishingPost}>{publishingPost ? "Publishing…" : "Publish photo"}</button></form><div className="section-title"><div><p className="tag">YOUR POSTS</p><h2>Photos</h2></div><span>{posts.length}</span></div>{posts.length ? <div className="social-post-list">{posts.map(post=><PostCard key={post.id} post={post} user={user} profile={profile} followingIds={followingIds} onToggleFollow={toggleFollow}/>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon">▧</div><h2>Your photos will live here</h2><p>Share a moment and it will show up on your profile.</p></div>}</div>;
  const renderGames = () => <div className="list-page games-page"><div className="list-heading"><p className="tag">PLAY A LITTLE</p><h1>Break the ice.</h1><p>Send a quick prompt to someone you have matched with.</p></div><section className="game-card"><div className="game-spark">✦</div><p className="tag">QUICK GAME</p><h2>{gamePrompt}</h2><button className="secondary" onClick={()=>setGamePrompt(gamePrompts[(gamePrompts.indexOf(gamePrompt)+1)%gamePrompts.length])}>Give me another prompt</button><form onSubmit={sendGameInvite}><label>Send it to<select value={gameChat} onChange={event=>setGameChat(event.target.value)}><option value="">Choose a friend</option>{conversations.filter(item=>item.members?.length===2).map(item=>{const uid=item.members.find(member=>member!==user.uid);return <option key={item.id} value={item.id}>{item.participantInfo?.[uid]?.name || "Friend"}</option>})}</select></label><button className="primary" type="submit" disabled={!conversations.some(item=>item.id===gameChat)}>Send game to chat</button></form></section></div>;  const callConversation = (conversation, type) => {
    const otherId = conversation.members.find(id => id !== user.uid);
    const target = { ...conversation, id: conversation.id, otherId, ...(conversation.participantInfo?.[otherId] || { name: "New friend" }) };
    setMatch(target);
    setView("chat");
    startCall(type, target);
  };  const send = async (e) => { e.preventDefault(); const value = text.trim(); if (!value || !match) return; setText(""); await addDoc(collection(db, "conversations", match.id, "messages"), { text: value, senderId: user.uid, type: "text", createdAt: serverTimestamp() }); await updateDoc(doc(db, "conversations", match.id), { updatedAt: serverTimestamp(), lastMessage: value }); };
  const upload = async (e) => { const file = e.target.files?.[0]; if (!file || !match) return; if (file.size > 5 * 1024 * 1024) return say("Please choose an image under 5 MB."); try { const location = ref(storage, `chat-media/${match.id}/${user.uid}-${Date.now()}-${file.name}`); await uploadBytes(location, file); const url = await getDownloadURL(location); await addDoc(collection(db, "conversations", match.id, "messages"), { imageUrl: url, senderId: user.uid, type: "image", createdAt: serverTimestamp() }); } catch { say("Upload failed. Enable Firebase Storage and publish its rules."); } };
  const report = async (reason) => { await addDoc(collection(db, "reports"), { reporterId: user.uid, reportedUserId: match.otherId, conversationId: match.id, reason, status: "open", createdAt: serverTimestamp() }); setReporting(false); say("Thanks — your report has been sent to the safety team."); };
  const block = async () => { await setDoc(doc(db, "users", user.uid), { blocked: [...(profile.blocked || []), match.otherId] }, { merge: true }); setProfile(p => ({ ...p, blocked: [...(p.blocked || []), match.otherId] })); say("This person is blocked. You won’t be matched again."); setMatch(null); setView("lobby"); };
  const requestNotifications = async () => { if (!("Notification" in window)) return say("Notifications aren’t supported by this browser."); const result = await Notification.requestPermission(); say(result === "granted" ? "Notifications are on." : "Notifications are off."); };
  const startCall = async (type = "video", callMatch = match) => {
    try {
      setCallType(type);
      const video = type === "video";
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      localStream.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peer.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.ontrack = event => {
        remoteStream.current = event.streams[0];
        if (video && remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
        if (!video && remoteAudio.current) remoteAudio.current.srcObject = event.streams[0];
      };
      const callDoc = doc(db, "calls", callMatch.id), candidates = collection(callDoc, "offerCandidates");
      pc.onicecandidate = event => event.candidate && addDoc(candidates, event.candidate.toJSON());
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(callDoc, { callerId: user.uid, calleeId: callMatch.otherId, type, offer: { type: offer.type, sdp: offer.sdp }, status: "calling", createdAt: serverTimestamp() });
      callLogRef.current = await addDoc(collection(db, "callLogs", user.uid, "items"), { conversationId: callMatch.id, otherUid: callMatch.otherId, otherName: callMatch.name, type, direction: "outgoing", status: "calling", createdAt: serverTimestamp() });
      onSnapshot(callDoc, snapshot => {
        const data = snapshot.data();
        if (data?.answer && !pc.currentRemoteDescription) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer)).then(() => {
            onSnapshot(collection(callDoc, "answerCandidates"), candidates => candidates.docChanges().forEach(change => change.type === "added" && pc.addIceCandidate(new RTCIceCandidate(change.doc.data()))));
          });
        }
      });
      setCall(true);
    } catch {
      peer.current?.close();
      peer.current = null;
      localStream.current?.getTracks().forEach(track => track.stop());
      localStream.current = null;
      say(type === "video" ? "Camera or microphone access was denied, or your browser does not support video calls." : "Microphone access was denied, or your browser does not support calls.");
    }
  };
  const answerCall = async () => {
    try {
      const callDoc = doc(db, "calls", match.id), data = (await getDoc(doc(db, "calls", match.id))).data();
      const type = data.type || "video", video = type === "video";
      setCallType(type);
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      localStream.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peer.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.ontrack = event => {
        remoteStream.current = event.streams[0];
        if (video && remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
        if (!video && remoteAudio.current) remoteAudio.current.srcObject = event.streams[0];
      };
      pc.onicecandidate = event => event.candidate && addDoc(collection(callDoc, "answerCandidates"), event.candidate.toJSON());
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(callDoc, { answer: { type: answer.type, sdp: answer.sdp }, status: "connected" });
      callLogRef.current = await addDoc(collection(db, "callLogs", user.uid, "items"), { conversationId: match.id, otherUid: match.otherId, otherName: match.name, type, direction: "incoming", status: "connected", createdAt: serverTimestamp() });
      onSnapshot(collection(callDoc, "offerCandidates"), snapshot => snapshot.docChanges().forEach(change => change.type === "added" && pc.addIceCandidate(new RTCIceCandidate(change.doc.data()))));
      setIncomingCall(false);
      setCall(true);
    } catch {
      peer.current?.close();
      peer.current = null;
      localStream.current?.getTracks().forEach(track => track.stop());
      localStream.current = null;
      say("Could not accept this call. Check your microphone or camera permissions.");
    }
  };
  const endCall = () => {
    peer.current?.getSenders().forEach(sender => sender.track?.stop());
    peer.current?.close();
    peer.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
    localStream.current = null;
    remoteStream.current = null;
    if (callLogRef.current) updateDoc(callLogRef.current, { status: "ended", endedAt: serverTimestamp() }).catch(error => console.error("BoloMasti call log update failed", error));
    callLogRef.current = null;
    setCall(false);
  };
  if (view === "loading") return <div className="screen loading">Loading BoloMasti…</div>;
  if (view === "firestoreError") return <div className="screen welcome"><a className="brand" href="/">bolo<em>masti</em><b>.</b></a><div className="welcome-card"><p className="tag">PROFILE COULD NOT LOAD</p><h1>We can’t open your <em>profile yet.</em></h1><p>You’re signed in, but Firestore denied access to your profile. Check the published Firestore rules in the Firebase project configured for this site.</p><button className="primary" onClick={() => window.location.reload()}>Try again</button><button className="switch-auth" onClick={() => signOut(auth)}>Sign out</button></div></div>;
  if (incomingCall && !call) return <div className="screen welcome"><a className="brand" href="/">bolo<em>masti</em><b>.</b></a><div className="welcome-card"><p className="tag">INCOMING {callType.toUpperCase()} CALL</p><h1>{match?.name || "Someone"} wants to <em>talk.</em></h1><p>Accept only when you’re ready. You can end the call at any time.</p><button className="primary" onClick={answerCall}>Accept call</button><button className="secondary" onClick={()=>setIncomingCall(false)}>Decline</button></div></div>;
  if (view === "setup") return <div className="screen welcome"><a className="brand" href="/">bolo<em>masti</em><b>.</b></a><div className="welcome-card"><p className="tag">ONE SMALL SETUP STEP</p><h1>Firebase needs<br /><em>your Netlify variables.</em></h1><p>Add the six <code>NEXT_PUBLIC_FIREBASE_…</code> variables in Netlify, then redeploy this site.</p><a className="primary" href="/">Back to home</a></div></div>;
  if (view === "verifyEmail") return <div className="screen welcome"><a className="brand" href="/">bolo<em>masti</em><b>.</b></a><div className="welcome-card"><p className="tag">ONE LAST STEP</p><h1>Check your <em>email.</em></h1><p>We sent a verification link to <strong>{user?.email}</strong>. Open it, then return here to continue.</p><button className="primary" onClick={finishVerification}>I’ve verified my email</button><button className="switch-auth" onClick={resendVerification}>Resend verification link</button><button className="switch-auth" onClick={()=>signOut(auth)}>Use a different account</button></div></div>;
  if (view === "welcome") return <div className="screen welcome"><a className="brand" href="/">bolo<em>masti</em><b>.</b></a><div className="welcome-card"><p className="tag">A LITTLE HELLO CAN CHANGE YOUR DAY</p><h1>Come for a chat.<br /><em>Stay for the masti.</em></h1><p>Meet someone new in a space built for good conversations.</p><div className="method-toggle"><button className={loginMethod === "email" ? "selected" : ""} onClick={()=>setLoginMethod("email")}>Email</button><button className={loginMethod === "phone" ? "selected" : ""} onClick={()=>setLoginMethod("phone")}>Phone</button></div>{loginMethod === "email" ? <form className="auth-form" onSubmit={emailLogin}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required /><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (6+ characters)" autoComplete={authMode === "signup" ? "new-password" : "current-password"} required /><button className="primary" type="submit" disabled={authBusy}>{authBusy ? "Just a moment…" : authMode === "signup" ? "Create account" : "Sign in"}</button></form> : <form className="auth-form" onSubmit={otpSent ? verifyOtp : sendOtp}>{otpSent ? <input inputMode="numeric" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit verification code" autoComplete="one-time-code" required /> : <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone number, e.g. +919876543210" autoComplete="tel" required />}<button className="primary" type="submit" disabled={authBusy}>{authBusy ? "Just a moment…" : otpSent ? "Verify and continue" : "Send verification code"}</button>{otpSent && <button type="button" className="switch-auth" onClick={()=>setOtpSent(false)}>Use a different number</button>}<div id="recaptcha-container" /></form>}{loginMethod === "email" && <button className="switch-auth" onClick={()=>setAuthMode(authMode === "signin" ? "signup" : "signin")}>{authMode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button>}<small>By continuing, you agree to be kind and keep BoloMasti safe.</small></div><Toast /></div>;
  if (view === "profile") return <div className="screen onboarding"><a className="brand" href="/">bolo<em>masti</em><b>.</b></a><form className="profile-card" onSubmit={saveProfile}><p className="tag">YOUR LITTLE CORNER</p><h2>{profile ? <>Edit your <em>profile.</em></> : <>Let’s set your <em>vibe.</em></>}</h2><p className="profile-intro">Choose how you want to meet people. You can change these details any time.</p><label>Name<input maxLength="28" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="What should we call you?" required /></label><label>Your gender<select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} required><option value="">Select your gender</option><option value="woman">Woman</option><option value="man">Man</option><option value="nonbinary">Non-binary</option><option value="self-described">Another gender</option></select></label><label>Preferred language<select value={form.language} onChange={e=>setForm({...form,language:e.target.value})} required><option value="">Choose a language</option>{languages.map(language=><option key={language} value={language}>{language}</option>)}</select></label><label>Short bio <span>(optional)</span><textarea maxLength="160" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="The kind of conversation you love…" /></label><label>Who would you like to meet?</label><div className="chips">{["woman","man","nonbinary","self-described","everyone"].map(g=><button type="button" onClick={()=>togglePreference(g)} className={form.interestedIn.includes(g)?"selected":""} key={g}>{g === "nonbinary" ? "Non-binary" : g === "everyone" ? "Everyone" : g === "self-described" ? "Another gender" : g === "woman" ? "Women" : "Men"}</button>)}</div><label>Your interests</label><div className="chips">{interests.map(x=><button type="button" onClick={()=>toggleInterest(x)} className={form.interests.includes(x)?"selected":""} key={x}>{x}</button>)}</div>{profile && <button type="button" className="secondary profile-cancel" onClick={()=>setView(returnView || "lobby")}>Cancel</button>}<button className="primary" type="submit">{profile ? "Save profile" : "Continue"}</button></form><Toast /></div>;  return <div className="app-shell app-mobile-shell">
    <aside>
      <div className="sidebar-brand-row"><a className="brand" href="/">bolo<em>masti</em><b>.</b></a><button className="notification-button" aria-label="Turn on notifications" onClick={requestNotifications}>♧</button></div>
      <div className="me"><div className="avatar">{profile?.name?.[0]}</div><div><b>{profile?.name}</b><small>{profile?.language} · {profile?.interests?.slice(0,2).join(" · ")}</small></div></div>
      <nav className="app-nav">
        <button className={view === "lobby" || view === "matching" ? "active" : ""} onClick={()=>setView("lobby")}><i>⌂</i><span>Discover</span></button>
        <button className={view === "chats" || view === "chat" ? "active" : ""} onClick={()=>setView("chats")}><i>◌</i><span>Chats</span></button>
        <button className={view === "calls" ? "active" : ""} onClick={()=>setView("calls")}><i>☎</i><span>Calls</span></button>
        <button className={view === "rooms" ? "active" : ""} onClick={()=>setView("rooms")}><i>◎</i><span>Rooms</span></button>
        <button className={view === "games" ? "active" : ""} onClick={()=>setView("games")}><i>✦</i><span>Games</span></button>
        <button className={view === "myProfile" || view === "profile" ? "active" : ""} onClick={()=>setView("myProfile")}><i>♡</i><span>Profile</span></button>
      </nav>
      <small className="safety-note">Your comfort comes first.<br />Report or leave any conversation.</small>
      <button className="signout-button" onClick={()=>signOut(auth)}>↪ Sign out</button>
    </aside>
    <section className="app-main">
      {(view === "lobby" || view === "matching") && <div className="lobby"><div className="orb">✦</div><p className="tag">{view === "matching" ? "FINDING YOUR PEOPLE" : "A LITTLE HELLO GOES A LONG WAY"}</p><h1>{view === "matching" ? "Looking for someone who speaks your language…" : <>Make a new <em>friend today.</em></>}</h1><p>{view === "matching" ? "We’re checking for someone who shares your interests and is looking to meet someone like you." : `Meet people who speak ${profile?.language || "your language"}, share your interests, and are open to a good conversation.`}</p>{view === "matching" ? <button className="secondary" onClick={leaveQueue}>Cancel search</button> : <button className="primary" onClick={startMatching}>Meet someone new <span>→</span></button>}<div className="interest-row">{profile?.interests?.map(x=><span key={x}>#{x}</span>)}</div><div className="profile-prefs"><span>{profile?.gender === "nonbinary" ? "Non-binary" : profile?.gender === "self-described" ? "Another gender" : profile?.gender}</span><span>Speaking {profile?.language}</span><span>Looking for {profile?.interestedIn?.map(g=>g === "everyone" ? "Everyone" : g === "nonbinary" ? "Non-binary" : g === "self-described" ? "Another gender" : g === "woman" ? "Women" : "Men").join(", ")}</span></div><div className="home-shortcuts"><button onClick={()=>setView("rooms")}>Join a friend circle <span>→</span></button><button onClick={()=>setView("games")}>Play an icebreaker <span>→</span></button></div></div>}
      {view === "lobby" && renderFeed()}
      {view === "chat" && <div className="chat"><header><button className="back" aria-label="Back to chats" onClick={()=>{unsubMessages.current?.();setView("chats")}}>←</button><div className="avatar">{match?.name?.[0]}</div><div className="chat-person"><b>{match?.name}</b><small>{match?.members?.length > 2 ? `${match.members.length} friends · group room` : "Your new friend · be kind"}</small></div><div className="chat-actions">{match?.members?.length <= 2 && <><button className="voice-action" aria-label="Start voice call" onClick={()=>startCall("voice")}>☎ Voice</button><button className="video-action" aria-label="Start video call" onClick={()=>startCall("video")}>◉ Video</button></>}<button className="more-action" aria-label="Safety options" onClick={()=>setReporting(true)}>•••</button></div></header><div className="messages"><p className="system">{match?.members?.length > 2 ? `Welcome to ${match?.name}. Keep it kind and have fun.` : "You matched! Say hello and see where it goes."}</p>{messages.map(m=><div className={m.senderId===user.uid?"message mine":"message"} key={m.id}>{match?.members?.length > 2 && <b className="message-sender">{m.senderId===user.uid ? "You" : match?.participantInfo?.[m.senderId]?.name || "Friend"}</b>}{m.imageUrl?<img src={m.imageUrl} alt="Shared in chat" />:<span>{m.text}</span>}<small>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : now()}</small></div>)}</div><form className="composer" onSubmit={send}><label className="upload">＋<input type="file" accept="image/*" onChange={upload}/></label><input value={text} onChange={e=>setText(e.target.value)} placeholder="Say something nice…"/><button className="send" aria-label="Send message">↑</button></form></div>}
      {view === "chats" && renderConversationList("chats")}
      {view === "calls" && renderCallHistory()}
      {view === "rooms" && renderConversationList("rooms")}
      {view === "games" && renderGames()}
      {view === "myProfile" && renderMyProfile()}
    </section>
    {reporting && <div className="modal"><div><button className="close" onClick={()=>setReporting(false)}>×</button><p className="tag">SAFETY FIRST</p><h2>What happened?</h2><button onClick={()=>report("Inappropriate content")}>Inappropriate content</button><button onClick={()=>report("Harassment or bullying")}>Harassment or bullying</button><button onClick={()=>report("Spam or scam")}>Spam or scam</button><button className="danger" onClick={block}>Block this person</button></div></div>}
    {followList && <div className="modal" onClick={()=>setFollowList(null)}><div className="follow-list-modal" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setFollowList(null)}>×</button><p className="tag">YOUR COMMUNITY</p><h2>{followList.title}</h2>{followList.items.length ? followList.items.map(person=><div className="follow-list-row" key={person.uid}><div className="mini-avatar">{person.name?.[0] || "F"}</div><b>{person.name || "Friend"}</b>{followList.title === "Following" && <button className="follow-button following" onClick={()=>toggleFollow(person)}>Following</button>}</div>) : <p className="follow-empty">No {followList.title.toLowerCase()} yet.</p>}</div></div>}
    {call && <div className={callType === "video" ? "call" : "call voice-call"}>{callType === "video" ? <><video ref={remoteVideo} autoPlay playsInline/><video ref={localVideo} autoPlay muted playsInline className="local-video"/></> : <><audio ref={remoteAudio} autoPlay/><div className="voice-avatar">{match?.name?.[0]}</div><p>Talking with {match?.name}</p></>}<button onClick={endCall}>End call</button></div>}
    {notice && <div className="toast">{notice}</div>}
  </div>;
}
