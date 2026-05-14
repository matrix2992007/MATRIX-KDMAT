// MATRIX KDMAT - CORE ENGINE v2.1.0
// Powered by Yosef Matrix

import { doc, setDoc, getDoc, updateDoc, collection, onSnapshot, query, where, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const db = window.matrixDB;
let currentUser = null;
let authMode = 'login';

// 1. نظام التحميل والتبديل (UI Logic)
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
    }, 1500);
});

window.toggleAuthMode = (mode) => {
    authMode = mode;
    const btn = document.getElementById('auth-btn');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');

    if (mode === 'login') {
        btn.innerText = "دخول النظام";
        loginTab.className = "flex-1 py-2 rounded-lg text-sm font-bold transition-all bg-emerald-500 text-slate-950";
        registerTab.className = "flex-1 py-2 rounded-lg text-sm font-bold transition-all text-slate-400";
    } else {
        btn.innerText = "إنشاء حساب جديد";
        registerTab.className = "flex-1 py-2 rounded-lg text-sm font-bold transition-all bg-emerald-500 text-slate-950";
        loginTab.className = "flex-1 py-2 rounded-lg text-sm font-bold transition-all text-slate-400";
    }
};

window.showSection = (id) => {
    document.querySelectorAll('.app-sec').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById('sec-' + id).classList.remove('hidden');
    document.querySelector(`[data-sec="${id}"]`).classList.add('active');
};

// 2. نظام المصادقة المربوط بـ Firebase
window.handleAuth = async () => {
    const user = document.getElementById('username').value.trim().toLowerCase();
    const phone = document.getElementById('phone').value.trim();
    const pass = document.getElementById('password').value;

    if (!user || !phone || !pass) return alert("⚠️ يرجى ملء جميع البيانات");

    const userRef = doc(db, "users", user);
    const snap = await getDoc(userRef);

    if (authMode === 'register') {
        if (snap.exists()) {
            alert("❌ اليوزر ده محجوز يا حب، اختار واحد تاني");
        } else {
            const userData = {
                username: user,
                phone: phone,
                password: pass,
                points: 0,
                role: 'member',
                joinedAt: new Date().toISOString()
            };
            await setDoc(userRef, userData);
            enterApp(userData);
        }
    } else {
        if (snap.exists() && snap.data().password === pass) {
            enterApp(snap.data());
        } else {
            alert("❌ بيانات الدخول غلط، ركز يا بطل");
        }
    }
};

function enterApp(userData) {
    currentUser = userData;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('user-display').innerText = userData.username.toUpperCase();
    
    // ربط النقاط لحظياً
    onSnapshot(doc(db, "users", userData.username), (doc) => {
        const points = doc.data().points || 0;
        document.getElementById('user-points').innerText = points;
        document.getElementById('wallet-points').innerText = points;
        currentUser.points = points;
    });

    loadUserLogs();
}

// 3. محرك استخراج الأرقام (OCR)
window.processOCR = async () => {
    if (currentUser.points < 10) return alert("⚠️ رصيدك غير كافٍ (تحتاج 10 نقاط)");

    const files = document.getElementById('ocr-upload').files;
    if (files.length === 0) return alert("اختار الصور الأول");

    const resultBox = document.getElementById('ocr-results');
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = "جاري تشغيل محرك X-150...<br>";

    try {
        for (let file of files) {
            const out = await Tesseract.recognize(file, 'eng');
            const matches = out.data.text.match(/\d{10,15}/g) || [];
            if (matches.length > 0) {
                resultBox.innerHTML += `✅ تم استخراج: ${matches.join(', ')}<br>`;
                // خصم النقاط وتسجيل العملية
                await updateDoc(doc(db, "users", currentUser.username), {
                    points: currentUser.points - 10
                });
                logAction("استخراج أرقام", -10);
            }
        }
    } catch (e) {
        alert("خطأ في المعالجة");
    }
};

// 4. نظام السيرة الذاتية (CV Maker)
window.generateCV = async () => {
    if (currentUser.points < 15) return alert("⚠️ رصيدك غير كافٍ (تحتاج 15 نقطة)");
    
    const name = document.getElementById('cv-name').value;
    const job = document.getElementById('cv-job').value;
    
    if(!name || !job) return alert("دخل بياناتك الأساسية");

    // عملية الحفظ بصيغة PDF
    const element = document.createElement('div');
    element.innerHTML = `
        <div style="padding:40px; font-family:Arial; color:#333;">
            <h1 style="color:#10b981;">${name}</h1>
            <h3>${job}</h3>
            <hr>
            <p>${document.getElementById('cv-about').value}</p>
            <p>الهاتف: ${document.getElementById('cv-phone').value}</p>
        </div>
    `;

    html2pdf().from(element).save(`${name}_CV.pdf`);
    
    await updateDoc(doc(db, "users", currentUser.username), {
        points: currentUser.points - 15
    });
    logAction("إنشاء سيرة ذاتية", -15);
};

// 5. نظام الشحن والعمليات
window.sendTopupRequest = async () => {
    const amount = document.getElementById('recharge-amount').value;
    if (!amount) return;

    await addDoc(collection(db, "requests"), {
        user: currentUser.username,
        amount: amount,
        status: 'pending',
        time: serverTimestamp()
    });
    alert("🚀 طلبك وصل للأدمن، ثواني والرصيد ينزل");
    logAction("طلب شحن رصيد", 0);
};

async function logAction(type, pts) {
    await addDoc(collection(db, "logs"), {
        user: currentUser.username,
        type: type,
        points: pts,
        time: serverTimestamp()
    });
}

function loadUserLogs() {
    const container = document.getElementById('user-logs');
    const q = query(collection(db, "logs"), where("user", "==", currentUser.username));
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        snap.forEach(doc => {
            const data = doc.data();
            container.innerHTML += `
                <div class="flex justify-between border-b border-white/5 py-1">
                    <span>${data.type}</span>
                    <span class="${data.points < 0 ? 'text-red-500' : 'text-emerald-500'}">${data.points}</span>
                </div>
            `;
        });
    });
}

// 6. نظام لوحة التحكم السري (Admin Panel)
let clicks = 0;
window.handleAdminTrigger = () => {
    clicks++;
    if (clicks >= 3) {
        document.getElementById('admin-login-modal').classList.remove('hidden');
        clicks = 0;
    }
};

window.verifyAdmin = () => {
    const pass = document.getElementById('admin-pass-input').value;
    if (pass === "reda1212X1167052487@") {
        document.getElementById('admin-login-modal').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminData();
    } else {
        alert("❌ الرمز غلط، ابعد يا هاكر");
    }
};

window.closeAdmin = () => document.getElementById('admin-panel').classList.add('hidden');

window.modifyPoints = async (type) => {
    const target = document.getElementById('target-user').value.toLowerCase();
    const pts = parseInt(document.getElementById('target-points').value);
    
    const ref = doc(db, "users", target);
    const snap = await getDoc(ref);
    
    if (snap.exists()) {
        const current = snap.data().points || 0;
        await updateDoc(ref, {
            points: type === 'add' ? current + pts : current - pts
        });
        alert("✅ تم تحديث الرصيد");
    } else {
        alert("المستخدم مش موجود");
    }
};

function loadAdminData() {
    const container = document.getElementById('admin-topup-logs');
    onSnapshot(collection(db, "requests"), (snap) => {
        container.innerHTML = "";
        snap.forEach(d => {
            const req = d.data();
            container.innerHTML += `
                <div class="p-3 bg-white/5 rounded-xl text-[10px] flex justify-between items-center">
                    <span>${req.user} عايز يشحن ${req.amount}</span>
                    <button onclick="confirmRequest('${d.id}', '${req.user}', ${req.amount})" class="text-emerald-500 font-bold">تأكيد ✅</button>
                </div>
            `;
        });
    });
}

window.confirmRequest = async (id, user, amount) => {
    const ref = doc(db, "users", user);
    const snap = await getDoc(ref);
    const current = snap.data().points || 0;
    await updateDoc(ref, { points: current + parseInt(amount) });
    // حذف الطلب بعد التأكيد
    // ملاحظة: يفضل تحديث الـ Status بدل الحذف، لكن للتسهيل هنحذفه
};

window.copy = (txt) => {
    navigator.clipboard.writeText(txt);
    alert("تم النسخ: " + txt);
};
