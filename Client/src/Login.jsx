import React from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FiArrowRight,
  FiCheckCircle,
  FiEye,
  FiLock,
  FiMail,
  FiUserPlus,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "./api";

// --- Main Login Component ---
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));
    if (token && user) {
      navigate(user.role === "admin" ? "/admindashboard" : "/dashboard");
    }
  }, [navigate]);

  // Clear error when user starts typing again
  useEffect(() => {
    if (error) {
      setError("");
    }
  }, [email, password]);

  // Handle navigation after successful login
  useEffect(() => {
    if (!isSuccess) return;

    const timer = setTimeout(() => {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user) {
        navigate(user.role === "admin" ? "/admindashboard" : "/dashboard");
      }
    }, 1500);

    return () => clearTimeout(timer); // Cleanup timeout on unmount
  }, [isSuccess, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || isSuccess) return;
    setError("");
    setIsLoading(true);

    // Get the API URL from environment variables, with a fallback for local development
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

    try {
      const data = await apiRequest("/api/auth/login", "POST", null, { email, password });
      setIsSuccess(true);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-['Poppins'] text-white/90 bg-[#08090a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
      <div className="absolute inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 flex flex-col lg:flex-row w-full max-w-5xl bg-white/[0.03] backdrop-blur-[40px] border border-white/10 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden"
      >
        <div className="w-full lg:w-2/5 p-12 flex flex-col justify-center items-center lg:items-start text-center lg:text-left relative overflow-hidden bg-gradient-to-b from-indigo-600/10 to-transparent">
          <div className="absolute inset-0 bg-indigo-600/5 animate-pulse" />
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="relative z-10"
          >
            <div className="inline-block p-5 mb-8 bg-indigo-500/10 rounded-[24px] border border-indigo-500/20 shadow-xl shadow-indigo-500/10">
              <FiLock className="text-indigo-400 text-5xl" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4 uppercase leading-none">
              Project<br /><span className="text-indigo-500">Sentinel</span>
            </h1>
            <p className="text-white/40 text-sm font-medium mb-10 leading-relaxed max-w-[260px]">
              Advanced enterprise security and seamless personnel management.
            </p>
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.05)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/signup")}
              className="w-full lg:w-auto text-xs font-black uppercase tracking-widest text-white border-2 border-white/10 py-4 px-8 rounded-2xl flex items-center justify-center gap-3 transition-colors hover:border-white/20"
            >
              <FiUserPlus size={18} /> Join Organization
            </motion.button>
          </motion.div>
        </div>
        <div className="w-full lg:w-3/5 p-8 lg:p-16 bg-white/[0.01]">
          <motion.div
            variants={{ error: { x: [0, -5, 5, -5, 5, 0] } }}
            animate={error ? "error" : ""}
          >
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <SuccessView isLogin={true} />
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h2 className="text-3xl font-black text-white mb-10 uppercase tracking-tight">
                    Welcome Back
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <FloatingLabelInput
                      id="email"
                      label="Email Address"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      Icon={FiMail}
                      autoComplete="email"
                    />
                    <FloatingLabelInput
                      id="password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={setPassword}
                      Icon={FiLock}
                      autoComplete="current-password"
                    >
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-1/2 right-4 -translate-y-1/2 text-white/20 hover:text-white/60 z-20 transition-colors"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? <FiEye /> : <FiLock className="rotate-12" />}
                      </button>
                    </FloatingLabelInput>
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          alert(
                            "Forgot password functionality is not yet implemented."
                          )
                        }
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-400/60 hover:text-indigo-400 transition-colors"
                      >
                        Recovery Access?
                      </button>
                    </div>
                    <div className="pt-6">
                      <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: "#4338ca" }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isLoading}
                        className="w-full text-sm font-black uppercase tracking-[0.2em] text-white bg-indigo-600 disabled:bg-indigo-900/50 py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 transition-all border border-indigo-500/20"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            Authenticate <FiArrowRight size={18} />
                          </>
                        )}
                      </motion.button>
                    </div>
                  </form>
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="text-center text-sm font-semibold text-red-400 bg-red-500/20 p-3 rounded-lg mt-6"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Child Components ---

const FloatingLabelInput = ({
  id,
  label,
  type,
  value,
  onChange,
  children,
  Icon,
  autoComplete,
}) => (
  <div className="relative w-full">
    {Icon && (
      <Icon className="absolute top-1/2 left-4 -translate-y-1/2 text-white/40 pointer-events-none" />
    )}
    <input
      id={id}
      className={clsx(
        "peer w-full bg-white/[0.03] border-2 border-white/10 rounded-2xl p-4 pt-7 text-sm text-white font-medium focus:outline-none focus:border-indigo-500/50 transition-all placeholder-transparent",
        Icon && "pl-12"
      )}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      required
      autoComplete={autoComplete}
    />
    <label
      htmlFor={id}
      className={clsx(
        "absolute text-white/20 transition-all duration-300 pointer-events-none font-bold uppercase tracking-widest",
        Icon ? "left-12" : "left-4",
        "peer-placeholder-shown:top-5 peer-placeholder-shown:text-xs",
        "peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-indigo-400",
        value && "top-2 text-[10px] text-indigo-400/60",
        "autofill:top-2 autofill:text-[10px]"
      )}
    >
      {label}
    </label>
    {children}
  </div>
);

const SuccessView = ({ isLogin }) => (
  <motion.div
    key="success"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="text-center flex flex-col items-center justify-center h-full min-h-[400px]"
  >
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="p-4 bg-emerald-500/20 rounded-full"
    >
      <FiCheckCircle className="text-emerald-400 text-6xl" />
    </motion.div>
    <h2 className="text-3xl font-bold text-white mt-6">
      {isLogin ? "Login Successful!" : "Account Created!"}
    </h2>
    <p className="text-white/60 mt-2">
      {isLogin ? "Redirecting..." : "You can now sign in."}
    </p>
  </motion.div>
);

export default Login;
