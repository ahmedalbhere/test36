import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  push, 
  onValue, 
  remove, 
  update, 
  get,
  off
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJ4VhGD49H3RNifMf9VCRPnkALAxNpsOU",
  authDomain: "project-2980864980936907935.firebaseapp.com",
  databaseURL: "https://project-2980864980936907935-default-rtdb.firebaseio.com",
  projectId: "project-2980864980936907935",
  storageBucket: "project-2980864980936907935.appspot.com",
  messagingSenderId: "580110751353",
  appId: "1:580110751353:web:8f039f9b34e1709d4126a8",
  measurementId: "G-R3JNPHCFZG"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

const state = {
  currentUser: null,
  currentUserType: null,
  barbers: {},
  queueListeners: {},
  barbersListener: null,
  currentRating: null
};

const elements = {
  screens: {
    roleSelection: document.getElementById('roleSelection'),
    clientLogin: document.getElementById('clientLogin'),
    barberLogin: document.getElementById('barberLogin'),
    clientDashboard: document.getElementById('clientDashboard'),
    barberDashboard: document.getElementById('barberDashboard')
  },
  client: {
    name: document.getElementById('clientName'),
    phone: document.getElementById('clientPhone'),
    error: document.getElementById('clientError'),
    avatar: document.getElementById('clientAvatar'),
    bookingContainer: document.getElementById('currentBookingContainer'),
    bookingBarber: document.getElementById('bookingBarber'),
    bookingPosition: document.getElementById('bookingPosition'),
    bookingTime: document.getElementById('bookingTime'),
    cancelBookingBtn: document.getElementById('cancelBookingBtn'),
    barbersList: document.getElementById('barbersList'),
    citySearch: document.getElementById('citySearch')
  },
  barber: {
    phone: document.getElementById('barberPhone'),
    password: document.getElementById('barberPassword'),
    name: document.getElementById('barberName'),
    newPhone: document.getElementById('newBarberPhone'),
    city: document.getElementById('barberCity'),
    location: document.getElementById('barberLocation'),
    newPassword: document.getElementById('newBarberPassword'),
    confirmPassword: document.getElementById('confirmBarberPassword'),
    error: document.getElementById('barberError'),
    avatar: document.getElementById('barberAvatar'),
    queue: document.getElementById('barberQueue'),
    statusToggle: document.getElementById('statusToggle'),
    statusText: document.getElementById('statusText'),
    formTitle: document.getElementById('barberFormTitle'),
    loginForm: document.getElementById('barberLoginForm'),
    signupForm: document.getElementById('barberSignupForm')
  },
  rating: {
    container: document.getElementById('ratingContainer'),
    stars: document.querySelectorAll('.stars i')
  }
};

const utils = {
  generateId: () => 'id-' + Math.random().toString(36).substr(2, 9),
  
  showError: (element, message) => {
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), 5000);
  },
  
  validatePhone: (phone) => /^[0-9]{10,15}$/.test(phone),
  
  clearForm: (formElements) => {
    Object.values(formElements).forEach(element => {
      if (element && element.value) element.value = '';
    });
  },
  
  debounce: (func, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }
};

function showScreen(screenId) {
  Object.values(elements.screens).forEach(screen => {
    screen.classList.add('hidden');
  });
  elements.screens[screenId].classList.remove('hidden');
  window.scrollTo(0, 0);
}

function showBarberSignup() {
  elements.barber.formTitle.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء حساب حلاق جديد';
  elements.barber.loginForm.classList.add('hidden');
  elements.barber.signupForm.classList.remove('hidden');
}

function showBarberLogin() {
  elements.barber.formTitle.innerHTML = '<i class="fas fa-cut"></i> تسجيل الدخول للحلاقين';
  elements.barber.signupForm.classList.add('hidden');
  elements.barber.loginForm.classList.remove('hidden');
}

async function clientLogin() {
  const name = elements.client.name.value.trim();
  const phone = elements.client.phone.value.trim();
  const rememberMe = document.getElementById('rememberMeClient').checked;
  
  if (!name) {
    utils.showError(elements.client.error, 'الرجاء إدخال الاسم');
    return;
  }
  
  if (!phone || !utils.validatePhone(phone)) {
    utils.showError(elements.client.error, 'الرجاء إدخال رقم هاتف صحيح (10-15 رقمًا)');
    return;
  }
  
  try {
    state.currentUser = {
      id: utils.generateId(),
      name,
      phone,
      type: 'client'
    };
    state.currentUserType = 'client';
    
    elements.client.avatar.textContent = name.charAt(0);
    showClientDashboard();
    await loadBarbers();
    await checkExistingBooking();
    
    if (rememberMe) {
      localStorage.setItem('client_data', JSON.stringify({ name, phone, remember: true }));
    } else {
      localStorage.removeItem('client_data');
    }
  } catch (error) {
    utils.showError(elements.client.error, 'حدث خطأ أثناء تسجيل الدخول');
    console.error('Client login error:', error);
  }
}

async function barberSignup() {
  const { name, newPhone, city, location, newPassword, confirmPassword, error } = elements.barber;
  
  if (!name.value || !newPhone.value || !city.value || !location.value || !newPassword.value || !confirmPassword.value) {
    utils.showError(error, 'جميع الحقول مطلوبة');
    return;
  }
  
  if (!utils.validatePhone(newPhone.value)) {
    utils.showError(error, 'رقم الهاتف يجب أن يكون بين 10-15 رقمًا');
    return;
  }
  
  if (newPassword.value.length < 6) {
    utils.showError(error, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    return;
  }
  
  if (newPassword.value !== confirmPassword.value) {
    utils.showError(error, 'كلمتا المرور غير متطابقتين');
    return;
  }
  
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      `${newPhone.value}@barber.com`, 
      newPassword.value
    );
    
    await set(ref(database, 'barbers/' + userCredential.user.uid), {
      name: name.value,
      phone: newPhone.value,
      city: city.value,
      location: location.value,
      status: 'open',
      queue: {},
      averageRating: 0,
      ratingCount: 0
    });
    
    state.currentUser = {
      id: userCredential.user.uid,
      name: name.value,
      phone: newPhone.value,
      city: city.value,
      location: location.value,
      type: 'barber'
    };
    
    elements.barber.avatar.textContent = name.value.charAt(0);
    showBarberDashboard();
    loadBarberQueue();
    
    utils.clearForm({
      name: name,
      newPhone: newPhone,
      city: city,
      location: location,
      newPassword: newPassword,
      confirmPassword: confirmPassword
    });
    
  } catch (error) {
    let errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'هذا الرقم مسجل بالفعل، يرجى تسجيل الدخول';
    }
    
    utils.showError(elements.barber.error, errorMessage);
    console.error('Barber signup error:', error);
  }
}

async function barberLogin() {
  const { phone, password, error } = elements.barber;
  const rememberMe = document.getElementById('rememberMeBarber').checked;
  
  if (!phone.value || !password.value) {
    utils.showError(error, 'رقم الهاتف وكلمة المرور مطلوبان');
    return;
  }
  
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      `${phone.value}@barber.com`,
      password.value
    );
    
    if (rememberMe) {
      localStorage.setItem('barber_login', JSON.stringify({
        phone: phone.value,
        password: password.value,
        remember: true
      }));
    } else {
      localStorage.removeItem('barber_login');
    }
    
    const barberRef = ref(database, 'barbers/' + userCredential.user.uid);
    const snapshot = await get(barberRef);
    
    if (snapshot.exists()) {
      const barberData = snapshot.val();
      
      state.currentUser = {
        id: userCredential.user.uid,
        name: barberData.name,
        phone: barberData.phone,
        city: barberData.city,
        location: barberData.location,
        type: 'barber'
      };
      
      elements.barber.avatar.textContent = barberData.name.charAt(0);
      showBarberDashboard();
      loadBarberQueue();
      
      utils.clearForm({
        phone: phone,
        password: password
      });
    } else {
      utils.showError(error, 'بيانات الحلاق غير موجودة');
      await signOut(auth);
    }
    
  } catch (error) {
    let errorMessage = 'بيانات الدخول غير صحيحة';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'لا يوجد حساب مرتبط بهذا الرقم';
    }
    
    utils.showError(elements.barber.error, errorMessage);
    console.error('Barber login error:', error);
  }
}

function showClientDashboard() {
  showScreen('clientDashboard');
}

function showBarberDashboard() {
  showScreen('barberDashboard');
  
  onValue(ref(database, 'barbers/' + state.currentUser.id + '/status'), (snapshot) => {
    const status = snapshot.val() || 'open';
    elements.barber.statusToggle.checked = status === 'open';
    elements.barber.statusText.textContent = status === 'open' ? 'مفتوح' : 'مغلق';
  });
  
  elements.barber.statusToggle.addEventListener('change', function() {
    const newStatus = this.checked ? 'open' : 'closed';
    update(ref(database, 'barbers/' + state.currentUser.id), { status: newStatus });
  });
}

async function loadBarbers() {
  elements.client.barbersList.innerHTML = '<div class="loading">جارٍ تحميل قائمة الحلاقين...</div>';
  
  if (state.barbersListener) {
    off(state.barbersListener);
  }
  
  state.barbersListener = onValue(ref(database, 'barbers'), (snapshot) => {
    state.barbers = snapshot.val() || {};
    renderBarbersList();
  }, (error) => {
    elements.client.barbersList.innerHTML = '<div class="error">حدث خطأ أثناء تحميل الحلاقين</div>';
    console.error('Load barbers error:', error);
  });
}

function renderBarbersList() {
  if (!elements.client.barbersList) return;
  
  elements.client.barbersList.innerHTML = '';
  
  if (!state.barbers || Object.keys(state.barbers).length === 0) {
    elements.client.barbersList.innerHTML = '<div class="no-results">لا يوجد حلاقون مسجلون حالياً</div>';
    return;
  }
  
  const sortedBarbers = Object.entries(state.barbers)
    .sort(([, a], [, b]) => (b.averageRating || 0) - (a.averageRating || 0));
  
  sortedBarbers.forEach(([id, barber], index) => {
    const isTopRated = index < 3 && barber.averageRating >= 4;
    
    const barberCard = document.createElement('div');
    barberCard.className = `barber-card ${isTopRated ? 'top-rated' : ''}`;
    
    const statusClass = barber.status === 'open' ? 'status-open' : 'status-closed';
    const statusText = barber.status === 'open' ? 'مفتوح' : 'مغلق';
    const queueLength =
