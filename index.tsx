
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';


// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let auth, db;
try {
  // Check if the essential config keys are provided
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      auth = firebase.auth();
      db = firebase.firestore();
  } else {
      console.error("Firebase configuration is missing or incomplete. Please set the required VITE_FIREBASE_* environment variables in your deployment settings.");
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
}


// --- HELPER FUNCTIONS ---
const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
const isSameDay = (date1, date2) =>
  date1.getFullYear() === date2.getFullYear() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getDate() === date2.getDate();

// --- UI COMPONENTS ---

const Spinner = () => (
    <div className="spinner-overlay">
        <div className="spinner"></div>
    </div>
);

const Notification = ({ message, type, onClear }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClear();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClear]);

    return <div className={`notification ${type}`}>{message}</div>;
};

const AppointmentModal = ({ isOpen, onClose, user, appointment, onSave, onDelete, setNotification }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (appointment) {
            setTitle(appointment.title || '');
            setDescription(appointment.description || '');
            const appDate = appointment.startTime.toDate();
            setDate(appDate.toISOString().split('T')[0]);
            setStartTime(appDate.toTimeString().substring(0, 5));
            setEndTime(appointment.endTime ? appointment.endTime.toDate().toTimeString().substring(0, 5) : '');
        } else {
            const now = new Date();
            now.setMinutes(now.getMinutes() + 10); 
            const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
            now.setMinutes(roundedMinutes);
            
            setDate(new Date().toISOString().split('T')[0]);
            setStartTime(now.toTimeString().substring(0, 5));
            const end = new Date(now.getTime() + 30 * 60000); 
            setEndTime(end.toTimeString().substring(0, 5));
            setTitle('');
            setDescription('');
        }
    }, [appointment, isOpen]);
    
    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !date || !startTime || !endTime) {
            setNotification({ type: 'error', message: 'נא למלא את כל שדות החובה.' });
            return;
        }
        setIsSaving(true);
        
        const startDateTime = new Date(`${date}T${startTime}`);
        const endDateTime = new Date(`${date}T${endTime}`);

        if (startDateTime >= endDateTime) {
            setNotification({ type: 'error', message: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.' });
            setIsSaving(false);
            return;
        }

        const data = {
            title,
            description,
            startTime: firebase.firestore.Timestamp.fromDate(startDateTime),
            endTime: firebase.firestore.Timestamp.fromDate(endDateTime),
            employeeId: user.uid,
            status: appointment?.status || 'pending',
        };
        await onSave(data, appointment?.id);
        setIsSaving(false);
    };

    const handleDelete = async () => {
        if (window.confirm('האם אתה בטוח שברצונך למחוק פגישה זו?')) {
            setIsSaving(true);
            await onDelete(appointment.id);
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                {isSaving && <Spinner />}
                <h2>{appointment ? 'עריכת פגישה' : 'פגישה חדשה'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="title">שם המוזמן</label>
                        <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="description">תיאור</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3}></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="date">תאריך</label>
                        <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="startTime">שעת התחלה</label>
                            <input id="startTime" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="endTime">שעת סיום</label>
                            <input id="endTime" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>שמירה</button>
                        {appointment && <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={isSaving}>מחיקה</button>}
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>ביטול</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AuthPage = () => {
    const [view, setView] = useState('login'); // 'login', 'register', 'forgotPassword'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleLogin = async (email, password) => {
        if (!auth) {
            setError("Firebase not initialized. Cannot log in.");
            return;
        }
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            setError('שם משתמש או סיסמה שגויים');
            console.error(error);
        }
        setIsLoading(false);
    };

    const handleRegister = async (fullName, email, password) => {
        if (!auth || !db) {
            setError("Firebase not initialized. Cannot register.");
            return;
        }
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await db.collection("users").doc(user.uid).set({
                name: fullName,
                email: user.email,
                role: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await auth.signOut();
            setView('login');
            setMessage('ההרשמה בוצעה בהצלחה. חשבונך ממתין לאישור מנהל.');
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                setError('כתובת דוא"ל זו כבר רשומה במערכת.');
            } else {
                setError('אירעה שגיאה ברישום. נסה שוב מאוחר יותר.');
            }
            console.error(error);
        }
        setIsLoading(false);
    };

    const handlePasswordReset = async (email) => {
        if (!auth) {
            setError("Firebase not initialized.");
            return;
        }
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            await auth.sendPasswordResetEmail(email);
            setMessage('נשלח קישור לאיפוס סיסמה לכתובת הדוא"ל שלך.');
            setView('login');
        } catch (error) {
            setError('לא ניתן לאפס סיסמה. ודא שכתובת הדוא"ל נכונה.');
            console.error(error);
        }
        setIsLoading(false);
    };

    const renderForm = () => {
        switch (view) {
            case 'register':
                return <RegisterForm onRegister={handleRegister} setView={setView} />;
            case 'forgotPassword':
                return <ForgotPasswordForm onPasswordReset={handlePasswordReset} setView={setView} />;
            default:
                return <LoginForm onLogin={handleLogin} setView={setView} />;
        }
    };

    return (
        <div className="auth-container">
            {isLoading && <Spinner />}
            <div className="auth-card">
                <h1>מערכת לניהול מוזמנים</h1>
                <p className="subtitle">לשירותים חברתיים כרמיאל</p>
                {error && <p className="error-message">{error}</p>}
                {message && <p className="message">{message}</p>}
                {renderForm()}
            </div>
        </div>
    );
};

const LoginForm = ({ onLogin, setView }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(email, password);
    };

    return (
        <>
            <form className="login-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="email">דואר אלקטרוני</label>
                    <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="password">סיסמה</label>
                    <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary">התחברות</button>
            </form>
            <div className="auth-links">
                <button onClick={() => setView('forgotPassword')}>שכחתי סיסמה</button>
                <span>|</span>
                <button onClick={() => setView('register')}>הרשמה</button>
            </div>
        </>
    );
};

const RegisterForm = ({ onRegister, setView }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('הסיסמאות אינן תואמות.');
            return;
        }
        setError('');
        onRegister(fullName, email, password);
    };

    return (
        <>
            <h2>הרשמה</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="fullName">שם מלא</label>
                    <input type="text" id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="reg-email">דואר אלקטרוני</label>
                    <input type="email" id="reg-email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="reg-password">סיסמה</label>
                    <input type="password" id="reg-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="confirm-password">אימות סיסמה</label>
                    <input type="password" id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
                {error && <p className="error-message">{error}</p>}
                <button type="submit" className="btn btn-primary">הרשמה</button>
            </form>
            <div className="auth-links">
                <button onClick={() => setView('login')}>חזרה להתחברות</button>
            </div>
        </>
    );
};

const ForgotPasswordForm = ({ onPasswordReset, setView }) => {
    const [email, setEmail] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onPasswordReset(email);
    };
    
    return (
        <>
            <h2>איפוס סיסמה</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="reset-email">דואר אלקטרוני</label>
                    <input type="email" id="reset-email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary">שלח קישור לאיפוס</button>
            </form>
             <div className="auth-links">
                <button onClick={() => setView('login')}>חזרה להתחברות</button>
            </div>
        </>
    );
};


const CalendarView = ({ user, setNotification }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    useEffect(() => {
        if (!user?.uid || !db) return;
        setIsLoading(true);
        const q = db.collection('appointments').where('employeeId', '==', user.uid);
        
        const unsubscribe = q.onSnapshot((querySnapshot) => {
            const userAppointments = [];
            querySnapshot.forEach((doc) => {
                userAppointments.push({ id: doc.id, ...doc.data() });
            });
            setAppointments(userAppointments);
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching appointments:", err);
            setNotification({type: 'error', message: 'שגיאה בטעינת הפגישות.'});
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user.uid, setNotification]);
    
    const handleSaveAppointment = async (data, id) => {
        try {
            if (id) {
                const docRef = db.collection('appointments').doc(id);
                await docRef.update(data);
                setNotification({ type: 'success', message: 'הפגישה עודכנה בהצלחה!' });
            } else {
                await db.collection('appointments').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                setNotification({ type: 'success', message: 'הפגישה נוצרה בהצלחה!' });
            }
            setIsModalOpen(false);
            setSelectedAppointment(null);
        } catch (error) {
            console.error("Error saving appointment:", error);
            setNotification({ type: 'error', message: 'שגיאה בשמירת הפגישה.' });
        }
    };
    
    const handleDeleteAppointment = async (id) => {
        try {
            await db.collection('appointments').doc(id).delete();
            setNotification({ type: 'success', message: 'הפגישה נמחקה.' });
            setIsModalOpen(false);
            setSelectedAppointment(null);
        } catch (error) {
            console.error("Error deleting appointment:", error);
            setNotification({ type: 'error', message: 'שגיאה במחיקת הפגישה.' });
        }
    };
    
    const openModalForNew = () => {
        setSelectedAppointment(null);
        setIsModalOpen(true);
    };

    const openModalForEdit = (app) => {
        setSelectedAppointment(app);
        setIsModalOpen(true);
    };

    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    const dayNames = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
    
    const changeMonth = (offset) => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    const goToToday = () => setCurrentDate(new Date());

    const renderCalendarGrid = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const cells = [];
        
        for (let i = 0; i < firstDay; i++) cells.push(<div key={`prev-${i}`} className="calendar-day other-month"></div>);

        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const appointmentsForDay = appointments
                .filter(app => app.startTime && isSameDay(app.startTime.toDate(), date))
                .sort((a,b) => a.startTime.toDate() - b.startTime.toDate());
            
            const isToday = isSameDay(date, today);
            const dayClasses = `calendar-day ${isToday ? 'is-today' : ''}`;

            cells.push(
                <div key={`current-${day}`} className={dayClasses}>
                    <div className="day-number">{day}</div>
                    <div className="appointments-list">
                        {appointmentsForDay.map(app => (
                            <div key={app.id} className="appointment-item" onClick={() => openModalForEdit(app)}>{app.title}</div>
                        ))}
                    </div>
                </div>
            );
        }

        while(cells.length % 7 !== 0 || cells.length < 35){
            cells.push(<div key={`next-${cells.length}`} className="calendar-day other-month"></div>);
        }
        
        return cells;
    };

    return (
        <div className="calendar-container">
            {isLoading && <Spinner />}
             <AppointmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={user}
                appointment={selectedAppointment}
                onSave={handleSaveAppointment}
                onDelete={handleDeleteAppointment}
                setNotification={setNotification}
            />
            <div className="calendar-header">
                <div className="calendar-nav">
                    <button onClick={() => changeMonth(-1)} className="nav-btn" aria-label="חודש קודם">{'<'}</button>
                    <button onClick={() => changeMonth(1)} className="nav-btn" aria-label="חודש הבא">{'>'}</button>
                    <button onClick={goToToday} className="today-btn">היום</button>
                </div>
                <h2>{`${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}</h2>
                 <button className="fab-header" onClick={openModalForNew} aria-label="הוסף פגישה חדשה">+</button>
            </div>
            <div className="calendar-grid">
                {dayNames.map(day => <div key={day} className="calendar-day-header">{day}</div>)}
                {renderCalendarGrid()}
            </div>
        </div>
    );
};

const SecurityView = ({ setNotification }) => {
    const [appointments, setAppointments] = useState([]);
    const [users, setUsers] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!db) return;
            try {
                const querySnapshot = await db.collection("users").get();
                const usersMap = {};
                querySnapshot.forEach((doc) => {
                    usersMap[doc.id] = doc.data().name || 'שם לא ידוע';
                });
                setUsers(usersMap);
            } catch (err) {
                 setNotification({type: 'error', message: 'שגיאה בטעינת משתמשים.'});
            }
        };
        fetchUsers();
    }, [setNotification]);
    
    useEffect(() => {
        if (!db || Object.keys(users).length === 0) return;
        
        setIsLoading(true);
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        const q = db.collection('appointments')
            .where('startTime', '>=', firebase.firestore.Timestamp.fromDate(startOfDay))
            .where('startTime', '<=', firebase.firestore.Timestamp.fromDate(endOfDay));

        const unsubscribe = q.onSnapshot((snapshot) => {
            const dailyAppointments = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
            setAppointments(dailyAppointments);
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching daily appointments:", err);
            setNotification({type: 'error', message: 'שגיאה בטעינת פגישות יומיות.'});
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [users, setNotification]);
    
    const handleStatusChange = async (id, newStatus) => {
        const docRef = db.collection('appointments').doc(id);
        try {
            await docRef.update({ status: newStatus });
            setNotification({type: 'success', message: 'סטטוס עודכן.'});
        } catch (err) {
            console.error("Error updating status:", err);
            setNotification({type: 'error', message: 'שגיאה בעדכון סטטוס.'});
        }
    };
    
    return (
        <div className="table-view-container">
            {isLoading && <Spinner />}
            <h1>פגישות להיום</h1>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>שעה</th>
                            <th>שם המוזמן</th>
                            <th>שם העובד/ת</th>
                            <th>סטטוס</th>
                            <th>פעולות</th>
                        </tr>
                    </thead>
                    <tbody>
                        {appointments.length > 0 ? appointments.map(app => (
                            <tr key={app.id}>
                                <td>{app.startTime.toDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td>{app.title}</td>
                                <td>{users[app.employeeId] || 'לא ידוע'}</td>
                                <td>
                                    <span className={`status-badge status-${app.status}`}>{
                                        { 'pending': 'ממתין', 'arrived': 'הגיע', 'no-show': 'לא הגיע' }[app.status]
                                    }</span>
                                </td>
                                <td className="action-cell">
                                    <button className="btn-action btn-success" onClick={() => handleStatusChange(app.id, 'arrived')}>הגיע</button>
                                    <button className="btn-action btn-danger" onClick={() => handleStatusChange(app.id, 'no-show')}>לא הגיע</button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5}>אין פגישות להיום.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AdminView = ({ setNotification }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        if (!db) return;
        setIsLoading(true);
        const usersUnsubscribe = db.collection("users").onSnapshot((snapshot) => {
            const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersList);
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching users:", err);
            setNotification({type: 'error', message: 'שגיאה בטעינת משתמשים.'});
            setIsLoading(false);
        });
        
        const pendingUsersQuery = db.collection("users").where("role", "==", "pending");
        const pendingUnsubscribe = pendingUsersQuery.onSnapshot((snapshot) => {
            setPendingCount(snapshot.size);
        });

        return () => {
            usersUnsubscribe();
            pendingUnsubscribe();
        };
    }, [setNotification]);

    const handleRoleChange = async (id, newRole) => {
        const docRef = db.collection('users').doc(id);
        try {
            await docRef.update({ role: newRole });
            setNotification({type: 'success', message: 'תפקיד עודכן בהצלחה!'});
        } catch (err) {
            console.error("Error updating role:", err);
            setNotification({type: 'error', message: 'שגיאה בעדכון התפקיד.'});
        }
    };
    
    const roles = ['pending', 'employee', 'security', 'admin'];
    
    return (
        <div className="table-view-container">
            {isLoading && <Spinner />}
            <h1>
                ניהול משתמשים
                {pendingCount > 0 && <span className="pending-badge">{pendingCount}</span>}
            </h1>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>שם</th>
                            <th>דוא"ל</th>
                            <th>תפקיד</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.sort((a,b) => a.role === 'pending' ? -1 : 1).map(user => (
                            <tr key={user.id} className={user.role === 'pending' ? 'pending-row' : ''}>
                                <td>{user.name || 'N/A'}</td>
                                <td>{user.email}</td>
                                <td>
                                    <select 
                                        className="role-select"
                                        value={user.role} 
                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                    >
                                        {roles.map(role => (
                                            <option key={role} value={role}>
                                                {{ 'pending': 'ממתין לאישור', 'employee': 'עובד/ת', 'security': 'מאבטח/ת', 'admin': 'מנהל/ת' }[role]}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const PendingView = () => (
    <div className="pending-container">
        <h1>החשבון בהמתנה לאישור</h1>
        <p>חשבונך נרשם בהצלחה וממתין לאישור של מנהל/ת המערכת.</p>
        <p>לאחר האישור, תקבל/י גישה מלאה למערכת.</p>
    </div>
);

const Header = ({ user, onLogout }) => (
    <header className="app-header">
        <h1>מערכת ניהול מוזמנים</h1>
        <div className="header-user-info">
            <span>שלום, {user.name}</span>
            <button onClick={onLogout} className="btn-logout">התנתקות</button>
        </div>
    </header>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (!auth || !db) {
        setAuthChecked(true);
        setIsLoading(false);
        return;
    }
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        const docRef = db.collection('users').doc(firebaseUser.uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          setUser({ uid: firebaseUser.uid, ...docSnap.data() });
        } else {
          console.error("No user document found in Firestore for authenticated user.");
          setUser(null);
          await auth.signOut();
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (auth) await auth.signOut();
  };
  
  const clearNotification = useCallback(() => setNotification(null), []);

  if (!authChecked || isLoading) {
    return <Spinner />;
  }
  
  const renderContent = () => {
      if (!user) {
          return <AuthPage />;
      }
      
      const dashboard = (content) => (
         <div className="dashboard-container">
            <Header user={user} onLogout={handleLogout} />
             <main className="main-content">{content}</main>
        </div>
      );

      switch (user.role) {
          case 'employee':
              return dashboard(<CalendarView user={user} setNotification={setNotification} />);
          case 'security':
              return dashboard(<SecurityView setNotification={setNotification} />);
          case 'admin':
               return dashboard(<AdminView setNotification={setNotification} />);
          case 'pending':
               return dashboard(<PendingView />);
          default:
              console.warn(`Unknown user role: ${user.role}`);
              return <AuthPage />;
      }
  };

  return (
    <>
        {notification && <Notification message={notification.message} type={notification.type} onClear={clearNotification} />}
        {renderContent()}
    </>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
}
