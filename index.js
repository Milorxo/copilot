import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- SVG ICON COMPONENTS ---

const LogoIcon = () => (
  <svg className="logo-symbol" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M86.2 66.2L73.1 73.1L66.2 86.2C63.4 92.4 56.6 95.8 50 95.8C43.4 95.8 36.6 92.4 33.8 86.2L26.9 73.1L13.8 66.2C7.6 63.4 4.2 56.6 4.2 50C4.2 43.4 7.6 36.6 13.8 33.8L26.9 26.9L33.8 13.8C36.6 7.6 43.4 4.2 50 4.2C56.6 4.2 63.4 7.6 66.2 13.8L73.1 26.9L86.2 33.8C92.4 36.6 95.8 43.4 95.8 50C95.8 56.6 92.4 63.4 86.2 66.2Z"
      stroke="var(--secondary-glow)"
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <circle cx="50" cy="50" r="18" stroke="var(--primary-glow)" strokeWidth="4" />
  </svg>
);


const GodIcon = () => (
    <svg className="category-icon" style={{'--glow-color': '#8e2de2'} as React.CSSProperties} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text
            x="50"
            y="62"
            fontFamily="Poppins, sans-serif"
            fontSize="50"
            fontWeight="700"
            fill="#8e2de2"
            textAnchor="middle"
            letterSpacing="1"
        >
            JW
        </text>
    </svg>
);

const PersonalIcon = () => (
    <svg className="category-icon" style={{'--glow-color': '#00ffe0'} as React.CSSProperties} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="35" r="15" stroke="#00ffe0" strokeWidth="6"/>
        <path d="M20 95 C 20 60, 80 60, 80 95" stroke="#00ffe0" strokeWidth="6" strokeLinecap="round" />
    </svg>
);

const HealthIcon = () => (
    <svg className="category-icon" style={{'--glow-color': '#ff4b4b'} as React.CSSProperties} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 50H25L35 30L45 70L55 40L65 60L75 50H90" stroke="#ff4b4b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const FolderIcon = () => <svg className="item-icon" style={{color: 'var(--primary-glow)'}} fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>;
const TaskIcon = () => <svg className="item-icon" style={{color: 'var(--secondary-glow)'}} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>;
const NoteIcon = () => <svg className="item-icon" style={{color: '#f0f0f0'}} fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h8a2 2 0 012 2v12l-5-3-5 3V6z"></path></svg>;
const BackIcon = () => <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
const AddIcon = () => <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const PencilIcon = () => <svg className="menu-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>;
const DeleteIcon = () => <svg className="menu-action-icon delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;


// --- INTERFACES ---

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

interface Item {
    id: number;
    name: string;
    type: 'Folder' | 'Task' | 'Note';
    children?: Item[]; // For folders
    content?: string;   // For notes (HTML content)
    tasks?: Task[];     // For tasks
}

interface ListItemProps {
    item: Item;
    onUpdate: (id: number, name: string) => void;
    onNavigate: (item: Item) => void;
    onEditStart: (id: number | null) => void;
    onDelete: (id: number) => void;
    isEditing: boolean;
}

// --- HELPER HOOK for click outside detection ---
const useOnClickOutside = (ref: React.RefObject<any>, handler: (event: MouseEvent | TouchEvent) => void) => {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target)) {
                return;
            }
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
};

// --- MAIN COMPONENTS ---

const Header = () => (
    <header className="header">
        <LogoIcon />
        <h1 className="logo-title">LifeSystem</h1>
    </header>
);

const Dashboard = ({ onSelectCategory }: { onSelectCategory: (name: string) => void }) => (
    <section className="dashboard view-container">
        <div className="category-box" onClick={() => onSelectCategory('God')}>
            <GodIcon />
            <h2 className="category-name">God</h2>
        </div>
        <div className="category-box" onClick={() => onSelectCategory('Personal')}>
            <PersonalIcon />
            <h2 className="category-name">Personal</h2>
        </div>
        <div className="category-box" onClick={() => onSelectCategory('Health')}>
            <HealthIcon />
            <h2 className="category-name">Health</h2>
        </div>
    </section>
);

const ListItem: React.FC<ListItemProps> = ({ item, onUpdate, onNavigate, onEditStart, onDelete, isEditing }) => {
    const [name, setName] = useState(item.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const menuContainerRef = useRef<HTMLDivElement>(null);
    const [isMenuOpen, setMenuOpen] = useState(false);

    useOnClickOutside(menuContainerRef, () => {
        if (isMenuOpen) {
            setMenuOpen(false);
        }
    });

    useEffect(() => {
        setName(item.name);
    }, [item.name]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);
    
    const handleBlur = () => {
        if (name.trim() === '') {
            setName(item.name);
        } else {
            onUpdate(item.id, name);
        }
        onEditStart(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBlur();
        else if (e.key === 'Escape') {
            setName(item.name);
            onEditStart(null);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (isEditing || menuContainerRef.current?.contains(e.target as Node)) {
          return;
        }
        onNavigate(item);
    };
    
    const handleRename = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEditStart(item.id);
        setMenuOpen(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
            onDelete(item.id);
        }
        setMenuOpen(false);
    };
    
    const getIcon = () => {
        switch (item.type) {
            case 'Folder': return <FolderIcon />;
            case 'Task': return <TaskIcon />;
            case 'Note': return <NoteIcon />;
        }
    }

    return (
        <li className="list-item" onClick={handleClick}>
            {getIcon()}
            <div className="item-main-content">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="item-input"
                    />
                ) : (
                    <span className="item-name" onDoubleClick={(e) => { e.stopPropagation(); onEditStart(item.id); }}>
                        {item.name}
                    </span>
                )}
            </div>
             <div className="item-menu-container" ref={menuContainerRef}>
                <button className="item-menu-button" onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }} aria-label="Item options">
                    ⋮
                </button>
                {isMenuOpen && (
                    <div className="item-popup-menu">
                        <button onClick={handleRename}><PencilIcon /> Rename</button>
                        <button onClick={handleDelete}><DeleteIcon /> Delete</button>
                    </div>
                )}
            </div>
        </li>
    );
};

const AddMenu = ({ onAdd, onClose }: { onAdd: (type: 'Folder' | 'Task' | 'Note') => void, onClose: () => void }) => {
    const menuRef = useRef(null);
    useOnClickOutside(menuRef, onClose);
    
    return (
        <div className="popup-menu" ref={menuRef}>
            <button onClick={() => onAdd('Folder')}>New Folder</button>
            <button onClick={() => onAdd('Task')}>New Task List</button>
            <button onClick={() => onAdd('Note')}>New Note</button>
        </div>
    );
};

// --- VIEWS ---

const CategoryView = ({ category, items, onNavigate, onUpdate, onAddItem, onDeleteItem, onBack, onEditStart, editingId }: {
    category: string;
    items: Item[];
    onNavigate: (item: Item) => void;
    onUpdate: (id: number, name: string) => void;
    onAddItem: (type: 'Folder' | 'Task' | 'Note') => void;
    onDeleteItem: (id: number) => void;
    onBack: () => void;
    onEditStart: (id: number | null) => void;
    editingId: number | null;
}) => {
    const [isAddMenuOpen, setAddMenuOpen] = useState(false);

    const handleAddItem = (type: 'Folder' | 'Task' | 'Note') => {
        onAddItem(type);
        setAddMenuOpen(false);
    };

    return (
        <section className="category-view view-container">
            <div className="category-header">
                <div className="header-left">
                    <button className="icon-button back-button" onClick={onBack} aria-label="Go Back">
                        <BackIcon />
                    </button>
                    <h2 className="category-title">{category}</h2>
                </div>
                <div className="header-right">
                    <div className="add-control">
                        <button className="icon-button" onClick={() => setAddMenuOpen(v => !v)} aria-label="Add new item">
                            <AddIcon />
                        </button>
                        {isAddMenuOpen && <AddMenu onAdd={handleAddItem} onClose={() => setAddMenuOpen(false)} />}
                    </div>
                </div>
            </div>
            
            <ul className="item-list">
                {items.length === 0 ? (
                    <p className="empty-message">This folder is empty.</p>
                ) : items.map((item) => (
                    <ListItem
                        key={item.id}
                        item={item}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                        onEditStart={onEditStart}
                        onDelete={onDeleteItem}
                        isEditing={editingId === item.id}
                    />
                ))}
            </ul>
        </section>
    );
};

const TaskView = ({ item, onBack, onUpdateTasks }: {
    item: Item;
    onBack: () => void;
    onUpdateTasks: (itemId: number, tasks: Task[]) => void;
}) => {
    const [tasks, setTasks] = useState<Task[]>(item.tasks || []);
    const [newTaskText, setNewTaskText] = useState('');

    const onUpdateTasksRef = useRef(onUpdateTasks);
    onUpdateTasksRef.current = onUpdateTasks;

    useEffect(() => {
        // Save on unmount
        return () => {
            onUpdateTasksRef.current(item.id, tasks);
        };
    }, [item.id, tasks]);

    const handleAddTask = () => {
        if (newTaskText.trim() === '') return;
        const newTask = { id: Date.now(), text: newTaskText, completed: false };
        const newTasks = [...tasks, newTask];
        setTasks(newTasks);
        onUpdateTasks(item.id, newTasks);
        setNewTaskText('');
    };

    const handleToggleTask = (id: number) => {
        const newTasks = tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task);
        setTasks(newTasks);
        onUpdateTasks(item.id, newTasks);
    };

    const handleDeleteTask = (id: number) => {
        const newTasks = tasks.filter(task => task.id !== id);
        setTasks(newTasks);
        onUpdateTasks(item.id, newTasks);
    };

    return (
        <section className="task-view view-container">
            <div className="category-header">
                 <div className="header-left">
                    <button className="icon-button" onClick={onBack} aria-label="Go Back">
                        <BackIcon />
                    </button>
                    <h2 className="category-title">{item.name}</h2>
                </div>
            </div>
            <ul className="task-list">
                {tasks.map(task => (
                    <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`} onClick={() => handleToggleTask(task.id)}>
                        <span>{task.text}</span>
                        <button className="icon-button" onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}>
                            <DeleteIcon />
                        </button>
                    </li>
                ))}
            </ul>
            <div className="task-add-control">
                <input
                    type="text"
                    className="item-input"
                    placeholder="Add a new task..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                />
                <button className="glow-button" onClick={handleAddTask}>Add Task</button>
            </div>
        </section>
    );
};

const NoteEditor = ({ item, onBack, onSave }: {
    item: Item;
    onBack: () => void;
    onSave: (itemId: number, content: string) => void;
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    
    const handleBlur = () => {
        if (editorRef.current) {
            onSave(item.id, editorRef.current.innerHTML);
        }
    };
    
    return (
        <section className="note-editor-view view-container">
            <div className="category-header">
                <div className="header-left">
                    <button className="icon-button" onClick={onBack} aria-label="Go Back">
                        <BackIcon />
                    </button>
                    <h2 className="category-title">{item.name}</h2>
                </div>
            </div>
            <div
                ref={editorRef}
                className="note-editor"
                contentEditable
                suppressContentEditableWarning
                onBlur={handleBlur}
                dangerouslySetInnerHTML={{ __html: item.content || '' }}
            />
        </section>
    );
};

const App = () => {
    const [currentCategory, setCurrentCategory] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<(string | number)[]>([]);
    const [data, setData] = useState<Record<string, { items: Item[] }>>({
        'God': { items: [] },
        'Personal': { items: [] },
        'Health': { items: [] },
    });
    const [editingId, setEditingId] = useState<number | null>(null);

    const findItemByPath = (path: (string|number)[], items: Item[]): Item | undefined => {
        let currentLevel = items;
        let foundItem: Item | undefined;
        for (const id of path) {
            foundItem = currentLevel.find(i => i.id === id);
            if (!foundItem) break;
            if (foundItem.children) {
                 currentLevel = foundItem.children;
            } else if (path[path.length - 1] !== id){
                 return undefined; // Path continues but item has no children
            }
        }
        return path.length > 0 ? foundItem : undefined;
    };
    
    const getCurrentItems = () => {
        if (!currentCategory) return [];
        const categoryData = data[currentCategory].items;
        if (currentPath.length === 0) return categoryData;
        const parent = findItemByPath(currentPath, categoryData);
        return parent?.children || [];
    };
    
    const updateItemsByPath = (path: (string|number)[], items: Item[], updateFn: (items: Item[]) => Item[]): Item[] => {
        if (path.length === 0) {
            return updateFn(items);
        }
        const currentId = path[0];
        const remainingPath = path.slice(1);
        return items.map(item => {
            if (item.id === currentId) {
                if (item.children) {
                    return { ...item, children: updateItemsByPath(remainingPath, item.children, updateFn) };
                }
            }
            return item;
        });
    };

    const handleSelectCategory = (name: string) => {
        setCurrentCategory(name);
        setCurrentPath([]);
    };
    
    const handleNavigate = (target: Item) => {
        setCurrentPath([...currentPath, target.id]);
    };
    
    const handleUpdateItem = (id: number, newName: string) => {
        if (!currentCategory) return;
        setData(prev => {
            const newItems = updateItemsByPath(currentPath, prev[currentCategory].items, items =>
                items.map(item => (item.id === id ? { ...item, name: newName } : item))
            );
            return { ...prev, [currentCategory]: { items: newItems } };
        });
    };

    const handleAddItem = (type: 'Folder' | 'Task' | 'Note') => {
        const newItem: Item = {
            id: Date.now(),
            name: `New ${type}`,
            type: type,
            ...(type === 'Folder' && { children: [] }),
            ...(type === 'Task' && { tasks: [] }),
            ...(type === 'Note' && { content: 'Start writing your note...' }),
        };
        if (!currentCategory) return;
        setData(prev => {
            const newItems = updateItemsByPath(currentPath, prev[currentCategory].items, items => [...items, newItem]);
            return { ...prev, [currentCategory]: { items: newItems } };
        });
        setEditingId(newItem.id);
    };
    
    const updateItemPropertyByPath = (path: (string|number)[], items: Item[], updateFn: (item: Item) => Item): Item[] => {
        if (path.length === 0) {
            return items;
        }
        const currentId = path[0];
        const remainingPath = path.slice(1);

        return items.map(item => {
            if (item.id === currentId) {
                if (remainingPath.length === 0) {
                    return updateFn(item);
                }
                if (item.children) {
                    return { ...item, children: updateItemPropertyByPath(remainingPath, item.children, updateFn) };
                }
            }
            return item;
        });
    };

    const handleUpdateNote = (id: number, content: string) => {
        if (!currentCategory) return;
        setData(prev => {
            const newItems = updateItemPropertyByPath(currentPath, prev[currentCategory].items, item =>
                item.id === id ? { ...item, content } : item
            );
            return { ...prev, [currentCategory]: { items: newItems } };
        });
    };

    const handleUpdateTasks = (id: number, tasks: Task[]) => {
         if (!currentCategory) return;
         setData(prev => {
            const newItems = updateItemPropertyByPath(currentPath, prev[currentCategory].items, item =>
                item.id === id ? { ...item, tasks } : item
            );
            return { ...prev, [currentCategory]: { items: newItems } };
        });
    };

    const handleBack = () => {
        if (currentPath.length > 0) {
            setCurrentPath(currentPath.slice(0, -1));
        } else {
            setCurrentCategory(null);
        }
    };

    const handleEditStart = (id: number | null) => {
        setEditingId(id);
    };

    const handleDeleteItem = (id: number) => {
        if (!currentCategory) return;
        setData(prev => ({
            ...prev,
            [currentCategory]: {
                ...prev[currentCategory],
                items: updateItemsByPath(currentPath, prev[currentCategory].items, items =>
                    items.filter(item => item.id !== id)
                ),
            },
        }));
    };
    
    const currentItems = getCurrentItems();
    const activeItem = currentCategory && currentPath.length > 0 ? findItemByPath(currentPath, data[currentCategory].items) : null;

    const renderContent = () => {
        if (activeItem?.type === 'Note') {
            return <NoteEditor item={activeItem} onBack={handleBack} onSave={handleUpdateNote} />;
        }
        if (activeItem?.type === 'Task') {
            return <TaskView item={activeItem} onBack={handleBack} onUpdateTasks={handleUpdateTasks} />;
        }
        if (currentCategory) {
            const categoryTitle = activeItem ? activeItem.name : currentCategory;
            return <CategoryView
                category={categoryTitle}
                items={currentItems}
                onNavigate={handleNavigate}
                onUpdate={handleUpdateItem}
                onAddItem={handleAddItem}
                onDeleteItem={handleDeleteItem}
                onBack={handleBack}
                onEditStart={handleEditStart}
                editingId={editingId}
            />;
        }
        return <Dashboard onSelectCategory={handleSelectCategory} />;
    }

    return (
        <div className="app-container" onClick={() => editingId && setEditingId(null)}>
            <Header />
            {renderContent()}
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
