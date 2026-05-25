
import React from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useRef, useState } from "react";
import {
  FiActivity,
  FiAlertOctagon,
  FiChevronDown,
  FiClipboard,
  FiFlag,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUser
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { apiRequest, API_BASE_URL } from "./api";

// NOTE: All initial/mock data has been removed.
// All data will now be fetched from the server.
// apiRequest utility has been moved to src/api.js

// --- Tooltip Component ---
const Tooltip = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative inline-block"
         onMouseEnter={() => setIsVisible(true)}
         onMouseLeave={() => setIsVisible(false)}>
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-md shadow-xl whitespace-nowrap z-[100] pointer-events-none"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-indigo-600" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Toast = ({ message, type = "success", onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={clsx(
        "fixed bottom-10 right-10 z-[200] px-8 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-4",
        {
          "bg-emerald-500/20 border-emerald-500/30 text-emerald-400": type === "success",
          "bg-red-500/20 border-red-500/30 text-red-400": type === "error",
          "bg-indigo-500/20 border-indigo-500/30 text-indigo-400": type === "info",
        }
      )}
    >
      <div className={clsx("w-2 h-2 rounded-full animate-pulse", {
        "bg-emerald-400": type === "success",
        "bg-red-400": type === "error",
        "bg-indigo-400": type === "info",
      })} />
      <span className="text-sm font-black uppercase tracking-widest">{message}</span>
    </motion.div>
  );
};

const AdminDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("Active");
  const [previewFile, setPreviewFile] = useState(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "Medium",
    dueDate: "",
    taskImage: null, // File object
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [editingTask, setEditingTask] = useState(null);

  const navigate = useNavigate();

  // Debouncing Search Query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Get user data and token from localStorage
  const loggedInAdmin = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token || !loggedInAdmin || loggedInAdmin.role !== "admin") {
      navigate("/login");
      return;
    }

    const fetchAdminData = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

        // Fetch employees and tasks concurrently with the correct URLs
        const [employeesData, tasksData] = await Promise.all([
          apiRequest("/api/admin/employees", "GET", token),
          apiRequest("/api/admin/tasks", "GET", token),
        ]);

        setEmployees(employeesData);
        setTasks(tasksData);
      } catch (err) {
        setError(err.message);
        if (err.message.includes("401") || err.message.includes("403")) {
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [navigate, token]); // Rerun if navigate or token changes

  const handlePreview = (filePath) => {
    setPreviewFile(filePath);
  };

  const closePreview = () => setPreviewFile(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (editingTask) {
      setEditingTask((prev) => ({ ...prev, [name]: value }));
    } else {
      setNewTask((prev) => ({ ...prev, [name]: value }));
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    const taskData = editingTask || newTask;
    if (!taskData.title || !taskData.assignedTo) {
      showToast("Please provide a title and assign the task.", "error");
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", taskData.title);
      formData.append("description", taskData.description);
      formData.append("priority", taskData.priority);
      formData.append("dueDate", taskData.dueDate);
      
      // If editing, we might want to reset status to In Progress
      if (editingTask) {
        formData.append("status", "In Progress");
      }
      
      const assignedToId = typeof taskData.assignedTo === 'object' ? taskData.assignedTo._id : taskData.assignedTo;
      formData.append("assignedTo", assignedToId);

      if (taskData.taskImage instanceof File) {
        formData.append("taskImage", taskData.taskImage);
      }

      let result;
      if (editingTask) {
        result = await apiRequest(`/api/tasks/${editingTask._id}`, "PUT", token, formData);
        showToast("Task updated and re-assigned!");
        setTasks(prev => prev.map(t => t._id === result._id ? { ...result, assignedTo: employees.find(e => e._id === assignedToId) } : t));
        setEditingTask(null);
      } else {
        result = await apiRequest("/api/admin/tasks", "POST", token, formData);
        const newTaskWithEmployee = {
          ...result,
          assignedTo: employees.find((emp) => emp._id === result.assignedTo),
        };
        setTasks((prevTasks) => [newTaskWithEmployee, ...prevTasks]);
        showToast("Task assigned successfully!");
      }

      setNewTask({
        title: "",
        description: "",
        assignedTo: "",
        priority: "Medium",
        dueDate: "",
        taskImage: null,
      });
    } catch (err) {
      console.error("Failed to process task:", err);
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveEmployee = async (userId) => {
    if (!window.confirm("Are you sure you want to remove this employee and all their assigned tasks?")) {
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest(`/api/admin/employees/${userId}`, "DELETE", token);
      setEmployees((prev) => prev.filter((emp) => emp._id !== userId));
      setTasks((prev) => prev.filter((task) => task.assignedTo?._id !== userId));
      showToast("Employee removed successfully");
    } catch (err) {
      console.error("Failed to remove employee:", err);
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTaskFileChange = (e) => {
    if (editingTask) {
      setEditingTask(prev => ({ ...prev, taskImage: e.target.files[0] }));
    } else {
      setNewTask(prev => ({ ...prev, taskImage: e.target.files[0] }));
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("/api/auth/logout", "POST", token);
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  const getFilteredTasks = () => {
    let filtered = tasks;
    if (filter === "Active") filtered = tasks.filter((t) => t.status !== "Done");
    else if (filter === "Completed") filtered = tasks.filter((t) => t.status === "Done");

    if (debouncedSearchTerm) {
      const query = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.assignedTo?.name?.toLowerCase().includes(query)
      );
    }
    return filtered;
  };

  const getFilteredEmployees = () => {
    if (!debouncedSearchTerm) return employees;
    const query = debouncedSearchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(query) ||
        emp._id.toString().includes(query)
    );
  };

  // Prevent rendering anything if the user is not authenticated yet
  if (!loggedInAdmin) return null;

  return (
    <div
      className="min-h-screen text-white/90 bg-[#08090a] overflow-x-hidden"
      style={{
        backgroundImage: `radial-gradient(at 0% 0%, hsla(215, 98%, 61%, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(125, 98%, 72%, 0.15) 0px, transparent 50%)`,
      }}
    >
      <header className="sticky top-0 z-40 bg-slate-900/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 sm:px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-500/20 shadow-lg">
              <FiUser className="text-white text-xl" />
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tighter uppercase whitespace-nowrap">
              Admin <span className="text-indigo-400">Portal</span>
            </h1>
          </div>

          <div className="flex-grow max-w-md mx-8 hidden md:block relative group">
            <input
              type="text"
              placeholder="Search tasks or team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-2 px-10 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-white/20"
            />
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
            <AnimatePresence>
              {searchTerm && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                >
                  <FiTrash2 size={14} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <div className="relative">
            <Tooltip text="User Settings">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all"
              >
                <img
                  src={loggedInAdmin.avatar}
                  alt="Admin"
                  className="w-8 h-8 rounded-full border border-indigo-500/30"
                />
                <span className="hidden sm:block text-xs font-bold px-1 uppercase tracking-tight">
                  {loggedInAdmin.name}
                </span>
                <FiChevronDown
                  className={clsx("transition-transform mr-2 text-indigo-400", {
                    "rotate-180": isProfileOpen,
                  })}
                />
              </motion.button>
            </Tooltip>
            <AnimatePresence>
              {isProfileOpen && (
                <ProfileDropdown
                  admin={loggedInAdmin}
                  onLogout={handleLogout}
                  close={() => setIsProfileOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <motion.div
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 xl:gap-12"
        >
          <motion.div
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: { y: 0, opacity: 1 },
            }}
            className="lg:col-span-2 xl:col-span-1"
          >
            <SectionHeader icon={<FiUser />} title="Team Status" />
            <div className="space-y-5">
              {loading ? (
                <p className="text-center text-white/50">
                  Loading employees...
                </p>
              ) : getFilteredEmployees().length > 0 ? (
                getFilteredEmployees().map((emp) => (
                  <EmployeeCard
                    key={emp._id}
                    employee={emp}
                    tasks={tasks}
                    onRemove={handleRemoveEmployee}
                    Tooltip={Tooltip}
                  />
                ))
              ) : (
                <div className="text-center py-10 opacity-30 font-black uppercase tracking-widest text-xs">No team matches found</div>
              )}
            </div>
          </motion.div>
          <motion.div
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: { y: 0, opacity: 1 },
            }}
          >
            <SectionHeader icon={<FiClipboard />} title={editingTask ? "Update Task" : "Assign New Task"} />
            <TaskAssignmentForm
              {...{ newTask: editingTask || newTask, handleInputChange, handleAssignTask, handleTaskFileChange, employees, isEditing: !!editingTask, cancelEdit: () => setEditingTask(null) }}
            />
          </motion.div>
          <motion.div
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: { y: 0, opacity: 1 },
            }}
            className="lg:col-span-2 xl:col-span-1"
          >
            <SectionHeader icon={<FiActivity />} title="Global Task Feed" />
            <div className="flex items-center gap-1 p-1 bg-white/5 backdrop-blur-md border border-white/5 rounded-2xl mb-6">
              {["Active", "Completed", "All"].map((tab) => (
                <Tooltip key={tab} text={`Show ${tab} Tasks`}>
                  <motion.button
                    onClick={() => setFilter(tab)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={clsx(
                      "w-full px-8 py-2.5 text-xs font-black rounded-lg transition-all uppercase tracking-widest",
                      {
                        "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20": filter === tab,
                        "text-white/40 hover:text-white": filter !== tab,
                      }
                    )}
                  >
                    {tab}
                  </motion.button>
                </Tooltip>
              ))}
            </div>
            <motion.div
              layout
              className="space-y-5 h-[70vh] overflow-y-auto pr-2"
            >
              <AnimatePresence>
                {loading ? (
                  <div className="text-center text-white/50">
                    Loading tasks...
                  </div>
                ) : error ? (
                  <div className="text-center text-red-400 bg-red-500/20 p-4 rounded-lg">
                    {error}
                  </div>
                ) : (
                  getFilteredTasks().map((task) => (
                    <AdminTaskCard key={task._id} task={task} onPreview={handlePreview} onEdit={() => setEditingTask(task)} />
                  ))
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </motion.div>
      </main>

      <AnimatePresence>
        {previewFile && (
          <PreviewModal filePath={previewFile} onClose={closePreview} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <Toast message={toast.message} type={toast.type}
                 onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Child Components ---

const ProfileDropdown = ({ admin, onLogout, close }) => {
  const dropdownRef = useRef(null);
  // ... (click outside effect remains)
  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="absolute top-full right-0 mt-2 w-64 bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden ring-1 ring-white/5"
    >
      <div className="p-4 border-b border-white/5">
        <p className="font-bold text-white mb-1">{admin.name}</p>
        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{admin.role}</p>
      </div>
      <div className="p-2">
        <motion.button
          whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          onClick={onLogout}
          className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-red-400 hover:text-red-300 font-medium"
        >
          <FiLogOut /> Logout
        </motion.button>
      </div>
    </motion.div>
  );
};

const SectionHeader = memo(({ icon, title }) => (
  <div className="flex items-center gap-4 mb-8">
    <div className="bg-indigo-600/10 p-3.5 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-inner">
      {icon}
    </div>
    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">{title}</h2>
  </div>
));
SectionHeader.displayName = "SectionHeader";

const EmployeeCard = memo(({ employee, tasks, onRemove, Tooltip }) => {
  const taskCount = tasks.filter(
    (t) => t.assignedTo?._id === employee._id && t.status !== "Done"
  ).length;
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      className="flex items-center gap-5 p-5 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg transition-all hover:bg-white/[0.07]"
    >
      <img
        src={employee.avatar}
        alt={employee.name}
        loading="lazy"
        className="w-14 h-14 rounded-2xl border-2 border-indigo-500/30 object-cover shadow-xl shadow-indigo-500/10"
      />
      <div className="flex-grow">
        <p className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{employee.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className={clsx("w-2 h-2 rounded-full", {
            "bg-green-400 animate-pulse": employee.status === "Online",
            "bg-slate-500": employee.status === "Offline",
          })} />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{employee.status}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-bold text-indigo-400">{taskCount}</p>
          <p className="text-[8px] text-white/30 uppercase font-black tracking-tighter">Active Tasks</p>
        </div>
        <Tooltip text="Remove Employee">
          <motion.button
            whileHover={{ scale: 1.1, backgroundColor: "rgba(239, 68, 68, 0.2)" }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onRemove(employee._id)}
            className="p-3 rounded-2xl text-red-500 bg-red-500/10 transition-colors border border-red-500/20 shadow-lg shadow-red-500/10"
          >
            <FiTrash2 size={18} />
          </motion.button>
        </Tooltip>
      </div>
    </motion.div>
  );
});
EmployeeCard.displayName = "EmployeeCard";

const TaskAssignmentForm = ({
  newTask,
  handleInputChange,
  handleAssignTask,
  handleTaskFileChange,
  employees,
  isEditing,
  cancelEdit
}) => {
  const commonInputClass =
    "w-full bg-slate-900/80 border border-slate-600 rounded-lg p-4 text-base text-white/90 focus:ring-2 focus:ring-indigo-500 focus:outline-none";
  return (
    <form
      onSubmit={handleAssignTask}
      className="p-6 sm:p-8 rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 space-y-6 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-3xl -z-10" />

      <div className="space-y-4">
        <input
          type="text"
          name="title"
          value={newTask.title}
          onChange={handleInputChange}
          placeholder="What's the task called?"
          required
          className="w-full bg-slate-900/40 border border-white/10 rounded-2xl p-4 text-base text-white placeholder:text-white/20 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
        />
        <textarea
          name="description"
          value={newTask.description}
          onChange={handleInputChange}
          placeholder="Describe the objective..."
          className="w-full bg-slate-900/40 border border-white/10 rounded-2xl p-4 text-base text-white placeholder:text-white/20 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all min-h-[140px] outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Assignee</label>
          <select
            name="assignedTo"
            value={newTask.assignedTo}
            onChange={handleInputChange}
            required
            className="w-full bg-slate-900/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none appearance-none"
          >
            <option value="" disabled className="bg-slate-900 text-white/50">Select Member</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id} className="bg-slate-900 text-white">
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Priority</label>
          <select
            name="priority"
            value={newTask.priority}
            onChange={handleInputChange}
            className="w-full bg-slate-900/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none appearance-none"
          >
             <option className="bg-slate-800">Low</option>
             <option className="bg-slate-800">Medium</option>
             <option className="bg-slate-800">High</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Deadline Date</label>
        <input
          type="date"
          name="dueDate"
          value={newTask.dueDate}
          onChange={handleInputChange}
          className="w-full bg-slate-900/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
        />
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Attachment (Docs/Images)</label>
        <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl group hover:border-indigo-500/50 transition-colors">
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleTaskFileChange}
            className="w-full text-xs text-white/40 file:mr-4 file:py-2 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-[0.2em] file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex gap-4">
        {isEditing && (
          <motion.button
            type="button"
            onClick={cancelEdit}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-1/3 text-xs font-black uppercase tracking-[0.2em] text-white/40 bg-white/5 hover:bg-white/10 py-5 rounded-2xl transition-all border border-white/5 flex items-center justify-center"
          >
            Cancel
          </motion.button>
        )}
        <motion.button
          type="submit"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className={clsx("text-sm font-black uppercase tracking-[0.2em] text-white py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3", 
            isEditing ? "w-2/3 bg-indigo-600 shadow-indigo-500/30" : "w-full bg-indigo-600 shadow-indigo-500/30"
          )}
        >
          {isEditing ? <FiActivity className="text-xl" /> : <FiPlus className="text-xl" />}
          {isEditing ? "Update Task" : "Create Task"}
        </motion.button>
      </div>
    </form>
  );
};

const FileDisplay = ({ filePath, label, isResult = false, onPreview }) => {
  if (!filePath) return null;
  const isImage = /\.(jpeg|jpg|png|webp)$/i.test(filePath);
  const isPDF = /\.pdf$/i.test(filePath);

  const containerClass = isResult
    ? "mb-6 rounded-2xl overflow-hidden border border-emerald-500/30 ring-4 ring-emerald-500/5 group cursor-pointer"
    : "mb-6 rounded-2xl overflow-hidden border border-white/5 bg-slate-900 group cursor-pointer";
  const labelText = isResult ? "Result Submission" : "Handout / Brief";

  return (
    <div
      className={containerClass}
      onClick={() => onPreview(filePath)}
    >
      {isImage ? (
        <img
          src={`${API_BASE_URL}${filePath}`}
          alt={label}
          loading="lazy"
          className="w-full h-auto max-h-56 object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="p-6 bg-slate-900/60 flex flex-col items-center gap-4 text-center group-hover:bg-slate-900/80 transition-colors">
          {isPDF ? (
            <FiActivity className="text-4xl text-red-400 group-hover:scale-110 transition-transform" />
          ) : (
            <FiClipboard className="text-4xl text-indigo-400 group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs text-white/40 font-bold tracking-tight">
            Click to Preview
          </span>
        </div>
      )}
      <div className={clsx("py-2.5 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-center border-t relative overflow-hidden", {
        "text-emerald-400 bg-emerald-500/10 border-emerald-500/10": isResult,
        "text-white/30 bg-white/5 border-white/5": !isResult
      })}>
        {labelText}
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors flex items-center justify-center">
         <div className="opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">View File</span>
         </div>
      </div>
    </div>
  );
};

const PreviewModal = ({ filePath, onClose }) => {
  const isImage = /\.(jpeg|jpg|png|webp)$/i.test(filePath);
  const isPDF = /\.pdf$/i.test(filePath);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-20 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative w-full max-w-5xl bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 flex flex-col h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40 px-4">
             File Preview
          </span>
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-white/5 hover:bg-red-500/20 text-white hover:text-red-400 transition-all border border-white/10"
          >
            <FiActivity className="rotate-45" />
          </button>
        </div>

        <div className="flex-1 w-full bg-slate-950 overflow-auto flex items-center justify-center p-4">
          {isImage ? (
            <img
              src={`${API_BASE_URL}${filePath}`}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />
          ) : isPDF ? (
            <object
              data={`${API_BASE_URL}${filePath}`}
              type="application/pdf"
              className="w-full h-full rounded-xl"
            >
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <FiActivity className="text-4xl text-indigo-400" />
                <p className="text-white/60">PDF preview not supported by your browser.</p>
                <a href={`${API_BASE_URL}${filePath}`} target="_blank" className="px-6 py-2 bg-indigo-600 text-white rounded-xl">Open PDF</a>
              </div>
            </object>
          ) : (
            <div className="text-center space-y-8 max-w-sm">
               <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto border border-white/10">
                  <FiClipboard className="text-4xl text-indigo-400" />
               </div>
               <div>
                  <h3 className="text-2xl font-black text-white mb-2">Native Preview Unavailable</h3>
                  <p className="text-white/40 text-sm font-medium">This file format cannot be viewed directly in the browser.</p>
               </div>
               <a
                  href={`${API_BASE_URL}${filePath}`}
                 target="_blank"
                 download
                 className="flex items-center justify-center gap-3 w-full py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20"
               >
                 <FiActivity /> Download Document
               </a>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const AdminTaskCard = memo(({ task, onPreview, onEdit }) => {
  const priorityConfig = {
    High: "text-red-400 bg-red-400/10 border-red-400/20",
    Medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    Low: "text-sky-400 bg-sky-400/10 border-sky-400/20",
  };
  const assignedEmployee = task.assignedTo;
  return (
    <motion.div
      layout
      whileHover={{ y: -5, scale: 1.01 }}
      className="p-6 rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl transition-all relative overflow-hidden group"
    >
      {task.hasIssue && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 shadow-[4px_0_15px_rgba(239,68,68,0.3)] z-20" />
      )}
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-3xl rounded-full -z-10 group-hover:bg-indigo-600/10 transition-colors" />

      <div className="flex justify-between items-start mb-5 gap-4">
        <h4 className="font-extrabold text-white text-lg tracking-tight group-hover:text-indigo-300 transition-colors">{task.title}</h4>
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "flex-shrink-0 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border",
              priorityConfig[task.priority]
            )}
          >
            <FiFlag size={10} /> {task.priority}
          </span>
          {task.hasIssue && (
            <Tooltip text="Issue reported by employee">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex-shrink-0 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10"
              >
                <FiAlertOctagon size={10} /> Issue Raised
              </motion.div>
            </Tooltip>
          )}
        </div>
      </div>

      <p className="text-sm text-white/40 mb-6 leading-relaxed font-medium line-clamp-3 group-hover:text-white/60 transition-colors">
        {task.description}
      </p>

      <FileDisplay filePath={task.taskImage} label="Handout" onPreview={onPreview} />
      <FileDisplay filePath={task.resultImage} label="Employee Submission" isResult onPreview={onPreview} />

      <div className="pt-5 border-t border-white/5 flex items-center justify-between mt-auto">
        {assignedEmployee ? (
          <div className="flex items-center gap-3">
            <img
              src={assignedEmployee.avatar}
              alt={assignedEmployee.name}
              loading="lazy"
              className="w-8 h-8 rounded-xl border border-white/10 shadow-lg"
            />
            <div className="flex flex-col">
              <span className="text-[10px] text-white/30 font-black uppercase tracking-widest leading-none">Assignee</span>
              <span className="text-xs text-white font-bold tracking-tight">
                {assignedEmployee.name}
              </span>
            </div>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3">
           <span className={clsx("text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-xl border", {
             "text-emerald-400 bg-emerald-500/10 border-emerald-500/10": task.status === "Done",
             "text-indigo-400 bg-indigo-500/10 border-indigo-500/10": task.status !== "Done",
           })}>
            {task.status === "Done" ? "Completed" : "In Progress"}
          </span>
          <Tooltip text={task.status === "Done" ? "Re-assign or Update Task" : "Edit Task Details"}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onEdit}
              className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 flex items-center gap-2"
            >
              <FiActivity size={14} />
              <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">
                {task.status === "Done" ? "Re-assign" : "Edit"}
              </span>
            </motion.button>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
});

export default AdminDashboard;
