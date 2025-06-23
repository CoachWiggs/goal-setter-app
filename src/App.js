/* global __firebase_config, __app_id, __initial_auth_token */
import React from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, query, updateDoc, writeBatch } from 'firebase/firestore';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// --- Icon Components (using SVG for simplicity) ---
const Star = ({ className = "w-6 h-6", isFilled = false }) => (
  <svg className={className} fill={isFilled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const Loader = () => (
    <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
    </div>
);
const CheckCircle = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const Sparkles = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM18 15.75l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 18l-1.035.259a3.375 3.375 0 00-2.456 2.456L18 21.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 18l1.035-.259a3.375 3.375 0 002.456-2.456z" />
    </svg>
);


// --- Firebase Configuration ---
// IMPORTANT: These are placeholders. In a real environment, these would be populated.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-goal-setter-app';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Draggable Goal Card Component ---
const ItemTypes = { GOAL: 'goal' };

const GoalCard = ({ goal, onSelect, isSelected, canSelect, isDraggable = false }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.GOAL,
        item: { id: goal.id },
        canDrag: isDraggable,
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));

    return (
        <div
            ref={drag}
            onClick={() => canSelect && onSelect(goal.id)}
            className={`p-4 mb-2 rounded-lg shadow-sm transition-all duration-200 ${
                isDragging ? 'opacity-50 scale-105' : 'opacity-100'
            } ${ canSelect ? 'cursor-pointer hover:shadow-md hover:bg-indigo-50' : ''
            } ${ isSelected ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-white'}`}
        >
            <p className="font-medium text-gray-800">{goal.title}</p>
        </div>
    );
};

// --- Drop Zone Column Component ---
const TimeHorizonColumn = ({ timeHorizon, goals, onDrop, children }) => {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: ItemTypes.GOAL,
        drop: (item) => onDrop(item.id, timeHorizon),
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }));

    return (
        <div ref={drop} className={`p-4 rounded-xl transition-colors duration-300 ${isOver ? 'bg-indigo-100' : 'bg-gray-100'}`}>
            <h3 className="font-bold text-lg text-gray-700 mb-4 border-b pb-2">{timeHorizon} Goals ({goals.length})</h3>
            <div className="min-h-[200px]">
                {children}
            </div>
        </div>
    );
};

// --- Main Application Component ---
export default function App() {
    // --- State Management ---
    const [step, setStep] = React.useState(0);
    const [userId, setUserId] = React.useState(null);
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    const [goals, setGoals] = React.useState([]);

    // --- Authentication ---
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setStep(data.step || 0);
                } else {
                    // New user, create their document
                    await setDoc(userDocRef, { name: '', step: 0 });
                }
                setIsAuthReady(true);
            } else {
                try {
                     if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Authentication Error:", error);
                    setIsAuthReady(true);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // --- Data Fetching ---
    React.useEffect(() => {
        if (!isAuthReady || !userId) return;

        const goalsCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'goals');
        const q = query(goalsCollectionRef);

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const goalsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGoals(goalsData);
            setIsLoading(false);
        }, (error) => {
            console.error("Firestore Snapshot Error:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthReady, userId]);
    
    // --- Update User Step in Firestore ---
    const updateUserStep = async (newStep) => {
        if (!userId) return;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        await updateDoc(userDocRef, { step: newStep });
        setStep(newStep);
    };


    const renderContent = () => {
        if (!isAuthReady || isLoading) {
            return <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50"><Loader /><p className="mt-4 text-gray-600">Setting things up...</p></div>;
        }

        switch (step) {
            case 0:
                return <WelcomeScreen userId={userId} updateUserStep={updateUserStep} />;
            case 1:
                return <BrainstormPhase userId={userId} goals={goals} updateUserStep={updateUserStep} />;
            case 2:
                return <CategorizePhase userId={userId} goals={goals} updateUserStep={updateUserStep} />;
            case 3:
                return <PrioritizePhase userId={userId} goals={goals} updateUserStep={updateUserStep} />;
            case 4:
                return <DashboardPhase userId={userId} goals={goals} updateUserStep={updateUserStep} />;
            default:
                return <div className="text-center p-8">Something went wrong. Please refresh.</div>;
        }
    };

    return <DndProvider backend={HTML5Backend}>{renderContent()}</DndProvider>;
}

// --- Phase 0: Welcome ---
const WelcomeScreen = ({ userId, updateUserStep }) => {
    const [name, setName] = React.useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (name.trim() && userId) {
            const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
            await setDoc(userDocRef, { name: name.trim(), step: 1 }, { merge: true });
            updateUserStep(1);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <Sparkles className="mx-auto h-12 w-12 text-indigo-500"/>
                <h1 className="text-4xl font-bold text-gray-800 mt-4">Welcome to Goal Setter</h1>
                <p className="text-lg text-gray-600 mt-2">Your personal roadmap to achieving your dreams.</p>
                <form onSubmit={handleSubmit} className="mt-8">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="What should we call you?"
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!name.trim()}
                        className="w-full mt-4 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition-all duration-300 transform hover:scale-105"
                    >
                        Let's Begin
                    </button>
                </form>
            </div>
        </div>
    );
};


// --- Phase 1: Brainstorming ("Heart Dump") ---
const BrainstormPhase = ({ userId, goals, updateUserStep }) => {
    const TIMER_DURATION = 15 * 60; // 15 minutes in seconds
    const [timeLeft, setTimeLeft] = React.useState(TIMER_DURATION);
    const [isTimerRunning, setIsTimerRunning] = React.useState(false);
    const [rawText, setRawText] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        let timer;
        if (isTimerRunning && timeLeft > 0) {
            timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        } else if (timeLeft === 0) {
            setIsTimerRunning(false);
        }
        return () => clearTimeout(timer);
    }, [isTimerRunning, timeLeft]);

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };
    
    const startTimer = () => {
        setIsTimerRunning(true);
        // Prefill text area with any existing uncategorized goals
        const existingText = goals
            .filter(g => !g.timeHorizon)
            .map(g => g.title)
            .join('\n');
        setRawText(existingText);
    };

    const handleSaveGoals = async () => {
        setIsSaving(true);
        const goalTitles = rawText.split('\n').map(t => t.trim()).filter(t => t.length > 0);
        const existingTitles = new Set(goals.filter(g => !g.timeHorizon).map(g => g.title));

        const batch = writeBatch(db);

        // Add new goals
        for (const title of goalTitles) {
            if (!existingTitles.has(title)) {
                const newGoalRef = doc(collection(db, 'artifacts', appId, 'users', userId, 'goals'));
                batch.set(newGoalRef, {
                    title: title,
                    createdAt: new Date(),
                    timeHorizon: null,
                    isTopGoal: false,
                    details: {},
                });
            }
        }
        
        await batch.commit();
        setIsSaving(false);
        updateUserStep(2);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800">Phase 1: The Brainstorm</h1>
                <p className="text-gray-600 mt-2">Let's start by getting everything out. Set the timer for 15 minutes and write down every goal that comes to your heart. Don't judge, just write.</p>

                <div className="my-6 p-6 bg-white rounded-xl shadow-lg">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-5xl font-mono font-bold text-indigo-600 p-4 border-4 border-indigo-200 rounded-lg">
                            {formatTime(timeLeft)}
                        </div>
                        {!isTimerRunning && timeLeft === TIMER_DURATION && (
                             <button onClick={startTimer} className="w-full sm:w-auto bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all transform hover:scale-105">
                                Start 15-Minute Timer
                            </button>
                        )}
                         {isTimerRunning && (
                            <p className="text-lg text-green-600 font-semibold animate-pulse">Timer is running...</p>
                        )}
                        {timeLeft === 0 && (
                            <div className="text-center sm:text-left">
                                <p className="text-lg text-green-600 font-semibold">Time's up!</p>
                                <p className="text-sm text-gray-500">You can continue writing or proceed.</p>
                            </div>
                        )}
                    </div>
                    {isTimerRunning || timeLeft === 0 || rawText.length > 0 ? (
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            className="w-full h-80 mt-6 p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
                            placeholder="A new car...&#10;Learn to code...&#10;Travel to Japan..."
                        />
                    ) : (
                        <div className="w-full h-80 mt-6 p-4 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                            <p className="text-gray-400">Click "Start Timer" to begin your session.</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        onClick={handleSaveGoals}
                        disabled={!rawText.trim() || isSaving}
                        className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-all transform hover:scale-105"
                    >
                        {isSaving ? 'Saving...' : 'Next: Categorize Goals'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Phase 2: Categorize Goals ---
const CategorizePhase = ({ userId, goals, updateUserStep }) => {
    const uncategorizedGoals = goals.filter(g => !g.timeHorizon);
    const timeHorizons = ["1 Year", "3 Years", "5 Years", "10+ Years"];

    const categorized = timeHorizons.reduce((acc, th) => {
        acc[th] = goals.filter(g => g.timeHorizon === th);
        return acc;
    }, {});

    const handleDrop = async (goalId, timeHorizon) => {
        const goalRef = doc(db, 'artifacts', appId, 'users', userId, 'goals', goalId);
        await updateDoc(goalRef, { timeHorizon });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800">Phase 2: Categorize Your Goals</h1>
                <p className="text-gray-600 mt-2">Now, let's organize. Drag each goal from your list on the left into the time frame you think it will take to achieve.</p>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
                    <div className="lg:col-span-1 p-4 bg-white rounded-xl shadow-lg">
                        <h3 className="font-bold text-lg text-gray-700 mb-4 border-b pb-2">Your List ({uncategorizedGoals.length})</h3>
                        <div className="min-h-[200px] max-h-[60vh] overflow-y-auto">
                             {uncategorizedGoals.length > 0 ? (
                                uncategorizedGoals.map(goal => <GoalCard key={goal.id} goal={goal} isDraggable={true} />)
                            ) : (
                                <div className="p-4 text-center text-gray-500">
                                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                                    <p className="mt-2 font-semibold">All goals categorized!</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        {timeHorizons.map(th => (
                            <TimeHorizonColumn key={th} timeHorizon={th} goals={categorized[th]} onDrop={handleDrop}>
                                {categorized[th].map(goal => <GoalCard key={goal.id} goal={goal} isDraggable={true} />)}
                            </TimeHorizonColumn>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end mt-8">
                     <button
                        onClick={() => updateUserStep(1)}
                        className="bg-gray-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-600 transition-all mr-4"
                    >
                        Back to Brainstorm
                    </button>
                    <button
                        onClick={() => updateUserStep(3)}
                        disabled={uncategorizedGoals.length > 0}
                        className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition-all transform hover:scale-105"
                    >
                        Next: Prioritize Goals
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Phase 3: Prioritize Goals ("Top 16") ---
const PrioritizePhase = ({ userId, goals, updateUserStep }) => {
    const [selectedGoals, setSelectedGoals] = React.useState({});
    const [isSaving, setIsSaving] = React.useState(false);
    const [showModal, setShowModal] = React.useState(false);
    const timeHorizons = ["1 Year", "3 Years", "5 Years", "10+ Years"];

    React.useEffect(() => {
        const initialSelection = goals
            .filter(g => g.isTopGoal)
            .reduce((acc, goal) => {
                if (!acc[goal.timeHorizon]) acc[goal.timeHorizon] = [];
                acc[goal.timeHorizon].push(goal.id);
                return acc;
            }, {});
        setSelectedGoals(initialSelection);
    }, [goals]);
    
    const handleSelect = (goalId, timeHorizon) => {
        setSelectedGoals(prev => {
            const newSelection = { ...prev };
            const currentSelection = newSelection[timeHorizon] || [];
            
            if (currentSelection.includes(goalId)) {
                newSelection[timeHorizon] = currentSelection.filter(id => id !== goalId);
            } else {
                if (currentSelection.length < 4) {
                    newSelection[timeHorizon] = [...currentSelection, goalId];
                }
            }
            return newSelection;
        });
    };

    const goalsByTimeHorizon = timeHorizons.reduce((acc, th) => {
        acc[th] = goals.filter(g => g.timeHorizon === th);
        return acc;
    }, {});

    const totalSelected = Object.values(selectedGoals).reduce((sum, arr) => sum + arr.length, 0);
    const isReady = timeHorizons.every(th => (selectedGoals[th]?.length || 0) === Math.min(4, goalsByTimeHorizon[th].length));
    
    const confirmSelection = () => {
        if(isReady) {
            setShowModal(true);
        }
    };

    const handleFinalize = async () => {
        setIsSaving(true);
        const batch = writeBatch(db);
        const allSelectedIds = new Set(Object.values(selectedGoals).flat());

        goals.forEach(goal => {
            const goalRef = doc(db, 'artifacts', appId, 'users', userId, 'goals', goal.id);
            const shouldBeTopGoal = allSelectedIds.has(goal.id);
            if (goal.isTopGoal !== shouldBeTopGoal) {
                 batch.update(goalRef, { isTopGoal: shouldBeTopGoal });
            }
        });

        await batch.commit();
        setIsSaving(false);
        setShowModal(false);
        updateUserStep(4);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800">Phase 3: Focus on Your Priorities</h1>
                <p className="text-gray-600 mt-2">Great work! Now, from each time frame, select your <span className="font-bold text-indigo-600">top 4 goals</span>. These will be your primary focus. Listen to your heart and mind.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-6">
                    {timeHorizons.map(th => (
                        <div key={th} className="p-4 bg-white rounded-xl shadow-lg">
                            <h3 className="font-bold text-lg text-gray-700 mb-4 border-b pb-2">{th} ({selectedGoals[th]?.length || 0} / 4 selected)</h3>
                            <div className="space-y-2">
                                {goalsByTimeHorizon[th].length > 0 ? goalsByTimeHorizon[th].map(goal => (
                                    <GoalCard 
                                        key={goal.id} 
                                        goal={goal}
                                        onSelect={() => handleSelect(goal.id, th)}
                                        isSelected={(selectedGoals[th] || []).includes(goal.id)}
                                        canSelect={true}
                                    />
                                )) : <p className="text-gray-500 p-4 text-center">No goals in this category.</p>}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm py-4 mt-8 rounded-t-xl shadow-top">
                   <div className="max-w-7xl mx-auto flex items-center justify-end px-4">
                     <button
                        onClick={() => updateUserStep(2)}
                        className="bg-gray-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-600 transition-all mr-4"
                    >
                        Back to Categorize
                    </button>
                    <button
                        onClick={confirmSelection}
                        disabled={!isReady || isSaving}
                        className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-all flex items-center gap-2 transform hover:scale-105"
                    >
                        <Star className="w-5 h-5" isFilled={true} />
                        {isSaving ? 'Finalizing...' : `Finalize Top ${totalSelected} Goals`}
                    </button>
                   </div>
                </div>
            </div>
            
            {showModal && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full transform transition-all scale-100">
                        <h2 className="text-2xl font-bold text-gray-800">The Mind & Heart Checkpoint</h2>
                        <p className="text-gray-600 mt-4">Take a deep breath. Look at this list of your top goals. Does this feel right? Does it represent the future you want to create?</p>
                        <p className="text-sm text-gray-500 mt-2">Remember, this is a living document. You can always come back and revise.</p>
                        <div className="mt-6 flex justify-end space-x-4">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300">Let me double-check</button>
                            <button onClick={handleFinalize} className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Yes, I'm Ready!</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Phase 4: Dashboard & Deep Dive ---
const DashboardPhase = ({ userId, goals, updateUserStep }) => {
    const [selectedGoal, setSelectedGoal] = React.useState(null);
    const topGoals = goals.filter(g => g.isTopGoal);

    if (selectedGoal) {
        return <GoalDetailView goalId={selectedGoal} userId={userId} onBack={() => setSelectedGoal(null)} />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Your Roadmap Dashboard</h1>
                        <p className="text-gray-600 mt-2">This is your command center. Click on a goal to add details and break it down into actionable steps.</p>
                    </div>
                    <button onClick={() => updateUserStep(3)} className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300">
                        &larr; Revise Top Goals
                    </button>
                </div>

                <div className="mt-8">
                    <h2 className="text-2xl font-bold text-indigo-700 mb-4">Your Top {topGoals.length} Goals</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        {topGoals.sort((a,b) => a.timeHorizon.localeCompare(b.timeHorizon)).map(goal => (
                            <div key={goal.id} onClick={() => setSelectedGoal(goal.id)} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between">
                                <div>
                                    <span className="text-sm font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">{goal.timeHorizon}</span>
                                    <p className="text-xl font-bold text-gray-800 mt-4">{goal.title}</p>
                                </div>
                                <div className="mt-4">
                                     <p className="text-sm text-indigo-600 font-semibold">View & Detail &rarr;</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Goal Detail & AI Assist View ---
const GoalDetailView = ({ goalId, userId, onBack }) => {
    const [goal, setGoal] = React.useState(null);
    const [details, setDetails] = React.useState({ color: '', size: '', much: '', where: '', month: '', description: '' });
    const [isSaving, setIsSaving] = React.useState(false);
    const [isAiLoading, setIsAiLoading] = React.useState(false);
    const [aiSuggestions, setAiSuggestions] = React.useState([]);

    React.useEffect(() => {
        const goalRef = doc(db, 'artifacts', appId, 'users', userId, 'goals', goalId);
        const unsubscribe = onSnapshot(goalRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setGoal({ id: doc.id, ...data });
                setDetails(data.details || { color: '', size: '', much: '', where: '', month: '', description: '' });
            }
        });
        return unsubscribe;
    }, [goalId, userId]);

    const handleDetailChange = (e) => {
        setDetails({ ...details, [e.target.name]: e.target.value });
    };

    const handleSaveDetails = async () => {
        setIsSaving(true);
        const goalRef = doc(db, 'artifacts', appId, 'users', userId, 'goals', goalId);
        await updateDoc(goalRef, { details });
        setIsSaving(false);
    };

    const getAiHelp = async () => {
        if (!goal?.title) return;
        setIsAiLoading(true);
        setAiSuggestions([]);

        const prompt = `My main goal is "${goal.title}". Based on this goal, break it down into 5 to 7 smaller, actionable steps a person can take. These steps should be specific and clear. The steps should be short, like a to-do list item.`;

        try {
            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = ""
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            
            if (result.candidates && result.candidates.length > 0) {
                 const text = result.candidates[0].content.parts[0].text;
                 const suggestions = text.split('\n').map(s => s.replace(/[-*]\s*/, '').trim()).filter(s => s);
                 setAiSuggestions(suggestions);
            } else {
                setAiSuggestions(["Sorry, the AI couldn't generate suggestions at this time. Please try again."]);
            }
        } catch (error) {
            console.error("AI Fetch Error:", error);
            setAiSuggestions(["There was an error connecting to the AI assistant. Please check your connection."]);
        }
        setIsAiLoading(false);
    };

    if (!goal) return <div className="p-8"><Loader /></div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <button onClick={onBack} className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 mb-6">
                    &larr; Back to Dashboard
                </button>
                <div className="bg-white p-8 rounded-xl shadow-lg">
                    <span className="text-sm font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">{goal.timeHorizon}</span>
                    <h1 className="text-4xl font-bold text-gray-800 mt-4">{goal.title}</h1>
                    <p className="text-gray-600 mt-4">Now, let's bring this goal to life. Describe it to a Tee. Every little detail matters.</p>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input type="text" name="color" value={details.color} onChange={handleDetailChange} placeholder="What color?" className="px-4 py-2 border rounded-lg"/>
                        <input type="text" name="size" value={details.size} onChange={handleDetailChange} placeholder="What size?" className="px-4 py-2 border rounded-lg"/>
                        <input type="text" name="much" value={details.much} onChange={handleDetailChange} placeholder="How much?" className="px-4 py-2 border rounded-lg"/>
                        <input type="text" name="where" value={details.where} onChange={handleDetailChange} placeholder="Where will it be?" className="px-4 py-2 border rounded-lg"/>
                        <input type="text" name="month" value={details.month} onChange={handleDetailChange} placeholder="What month/year?" className="px-4 py-2 border rounded-lg"/>
                    </div>
                    <textarea name="description" value={details.description} onChange={handleDetailChange} placeholder="Describe the goal in full detail as if you have it now..." className="w-full h-32 mt-6 p-4 border rounded-lg"/>
                    <button onClick={handleSaveDetails} disabled={isSaving} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300">
                        {isSaving ? 'Saving...' : 'Save Details'}
                    </button>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-lg mt-8">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Sparkles className="text-amber-500 w-7 h-7"/> AI Goal Assistant</h2>
                    <p className="text-gray-600 mt-2">Feeling stuck? Let our AI help you break this goal down into smaller, actionable steps.</p>
                    <button onClick={getAiHelp} disabled={isAiLoading} className="mt-4 bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 disabled:bg-amber-300 flex items-center gap-2">
                        {isAiLoading ? <Loader /> : 'Generate Action Steps'}
                    </button>
                    {isAiLoading && <p className="mt-4 text-gray-500">AI is thinking...</p>}
                    {aiSuggestions.length > 0 && (
                        <div className="mt-6 space-y-3">
                            <h3 className="font-semibold text-lg">Suggested Next Steps:</h3>
                             <ul className="list-disc list-inside space-y-2 text-gray-700">
                                {aiSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
