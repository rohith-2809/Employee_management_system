
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path"); // For serving static files
const fs = require("fs");
const multer = require("multer");
const helmet = require("helmet"); // For security headers

require("dotenv").config();



const app = express();
const https = require("https"); // For keep-alive self-ping
const PORT = process.env.PORT || 5000;

// --- Security and CORS Middleware ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false, // Essential for loading cross-origin resources without COEP
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "frame-ancestors": ["'self'", process.env.CLIENT_URL || "http://localhost:5173"],
      },
    },
  })
);



app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(bodyParser.json());

// --- Request Logging Middleware ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    console.log("Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// --- Multer Configuration for File Uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    console.log(`[MULTER DEBUG] Processing file: ${file.originalname} (${file.mimetype})`);
    const filetypes = /jpeg|jpg|png|webp|pdf|doc|docx|xls|xlsx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    // Support common variant mimetypes
    const mimetype = filetypes.test(file.mimetype) ||
                     file.mimetype.includes("image/") ||
                     file.mimetype.includes("application/pdf") ||
                     file.mimetype.includes("application/msword") ||
                     file.mimetype.includes("application/vnd.openxmlformats-officedocument");

    if (mimetype && extname) {
      return cb(null, true);
    }

    console.error(`[MULTER REJECTED] ${file.originalname}: mimetype=${file.mimetype}, ext=${path.extname(file.originalname)}`);
    cb(new Error("Allowed formats: images, pdf, doc, docx, xls, xlsx"));
  },
});

// Explicitly set CORP for static files to ensure they are loadable cross-origin
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static("uploads"));

// --- Helper function for generating a unique color from username ---
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).substr(-2);
  }
  return color;
};

// --- Helper function to generate SVG avatar ---
const generateAvatar = (username) => {
  const firstLetter = username.charAt(0).toUpperCase();
  const bgColor = stringToColor(username);

  const svg = `
        <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
            <rect width="128" height="128" fill="${bgColor}" />
            <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" fill="#ffffff">
                ${firstLetter}
            </text>
        </svg>
    `;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

// --- Mongoose Schemas & Models ---
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "employee"], default: "employee" },
    avatar: { type: String },
    status: { type: String, enum: ["Online", "Offline"], default: "Offline" },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
const User = mongoose.model("User", UserSchema);

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Done"],
      default: "Pending",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    dueDate: { type: Date },
    hasIssue: { type: Boolean, default: false },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    taskImage: { type: String }, // Image uploaded by admin
    resultImage: { type: String }, // Image uploaded by employee (result)
  },
  { timestamps: true }
);
const Task = mongoose.model("Task", TaskSchema);

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Notification = mongoose.model("Notification", NotificationSchema);

// --- Admin User Seeding Function ---
const seedAdminUsers = async () => {
  try {
    const adminCredentials = [
      {
        email: process.env.FIRST_ADMIN_EMAIL,
        password: process.env.PASSWORD,
        name: "Rohith (Admin)",
        username: "rohithadmin",
      },
      {
        email: process.env.SECOND_ADMIN_EMAIL,
        password: process.env.SECOND_PASSWORD,
        name: "Sarang (Admin)",
        username: "sarangadmin",
      },
    ];

    for (const admin of adminCredentials) {
      if (!admin.email || !admin.password) continue;
      const existingAdmin = await User.findOne({ email: admin.email });
      if (!existingAdmin) {
        const newAdmin = new User({
          name: admin.name,
          username: admin.username,
          email: admin.email,
          password: admin.password,
          role: "admin",
          avatar: generateAvatar(admin.username),
        });
        await newAdmin.save();
        console.log(`Admin user ${admin.email} created.`);
      }
    }
  } catch (error) {
    console.error("Error seeding admin users:", error);
  }
};

// --- MongoDB Connection ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully.");
    seedAdminUsers();
  })
  .catch((err) => console.error("MongoDB connection error:", err));
mongoose.connection.on("error", (err) => {
  console.error(`MongoDB connection error: ${err}`);
});

// --- JWT Middleware ---
const authenticateToken = (req, res, next) => {
  console.log(`[AUTH DEBUG] authenticateToken called for ${req.method} ${req.url}`);
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    console.warn("[AUTH DEBUG] No token provided in authorization header");
    return res.status(401).json({ message: "No authentication token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error(`[AUTH DEBUG] Token verification failed: ${err.message}`);
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};


// --- Render Keep-Alive ---
// This keeps the Render free tier from sleeping by pinging it every 14 minutes.
app.get("/api/ping", (req, res) => res.status(200).send("pong"));

const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
  setInterval(() => {
    https.get(`${RENDER_EXTERNAL_URL}/api/ping`, (res) => {
      console.log(`[KEEP-ALIVE] Ping sent: ${res.statusCode}`);
    }).on("error", (err) => {
      console.error("[KEEP-ALIVE] Error:", err.message);
    });
  }, 14 * 60 * 1000); // 14 minutes
}

// --- Notification Routes ---
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications", error: error.message });
  }
});

app.put("/api/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: "Error updating notification", error: error.message });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, name, email, password } = req.body;
    if (!username || !name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });

    const adminEmails = [
      process.env.FIRST_ADMIN_EMAIL,
      process.env.SECOND_ADMIN_EMAIL,
    ].filter(Boolean);
    const role = adminEmails.includes(email) ? "admin" : "employee";

    const newUser = new User({
      username,
      name,
      email,
      password,
      role,
      avatar: generateAvatar(username),
    });
    await newUser.save();
    res.status(201).json({ message: "Account created successfully!" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error during signup.", error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials." });

    await User.findByIdAndUpdate(user._id, { status: "Online" });
    const tokenPayload = {
      id: user._id,
      role: user.role,
      name: user.name,
      avatar: user.avatar,
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });
    res.json({ token, user: tokenPayload });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error during login.", error: error.message });
  }
});

app.post("/api/auth/logout", authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { status: "Offline" });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error during logout.", error: error.message });
  }
});

app.get(
  "/api/admin/employees",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const employees = await User.find({ role: "employee" }).select(
        "-password"
      );
      res.json(employees);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching employees.", error: error.message });
    }
  }
);

app.delete(
  "/api/admin/employees/:userId",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "Employee not found." });
      }

      if (user.role === "admin") {
        return res.status(403).json({ message: "Cannot delete administrators." });
      }

      // Cleanup associated tasks
      await Task.deleteMany({ assignedTo: userId });
      await User.findByIdAndDelete(userId);

      res.json({ message: "Employee and associated tasks removed successfully." });
    } catch (error) {
      console.error("Employee deletion error:", error);
      res.status(500).json({ message: "Failed to remove employee.", error: error.message });
    }
  }
);


app.get("/api/admin/tasks", authenticateToken, isAdmin, async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "name avatar")
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching tasks.", error: error.message });
  }
});

app.post(
  "/api/admin/tasks",
  authenticateToken,
  isAdmin,
  upload.single("taskImage"),
  async (req, res) => {
    try {
      const { title, description, assignedTo, priority, dueDate } = req.body;
      if (!title || !assignedTo)
        return res
          .status(400)
          .json({ message: "Title and assigned employee are required" });

      const taskData = {
        title,
        description,
        assignedTo,
        priority,
        dueDate,
      };

      if (req.file) {
        taskData.taskImage = `/uploads/${req.file.filename}`;
        console.log("File uploaded:", req.file.filename);
      }

      const newTask = await Task.create(taskData);

      // Create a notification for the employee
      await Notification.create({
        recipient: assignedTo,
        title: "New Task Assigned",
        message: `You have been assigned a new task: ${title}`,
        taskId: newTask._id,
      });

      res.status(201).json(newTask);
    } catch (error) {
      console.error("DEBUG: Error creating task:", error);
      res
        .status(500)
        .json({ message: "Error creating task.", error: error.message });
    }
  }
);

app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const userTasks = await Task.find({ assignedTo: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(userTasks);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching user tasks.", error: error.message });
  }
});

app.put(
  "/api/tasks/:taskId",
  authenticateToken,
  upload.single("resultImage"),
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const { description, status, hasIssue } = req.body;
      const task = await Task.findById(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      if (
        task.assignedTo.toString() !== req.user.id &&
        req.user.role !== "admin"
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this task." });
      }

      if (description !== undefined) task.description = description;
      if (status !== undefined) task.status = status;
      if (hasIssue !== undefined) task.hasIssue = hasIssue;

      if (req.file) {
        task.resultImage = `/uploads/${req.file.filename}`;
        console.log("File uploaded (result):", req.file.filename);
      }

      const updatedTask = await task.save();

      // If updated by admin, notify the employee
      if (req.user.role === "admin") {
        await Notification.create({
          recipient: updatedTask.assignedTo,
          title: "Task Updated/Re-assigned",
          message: `Your task "${updatedTask.title}" has been updated or re-assigned.`,
          taskId: updatedTask._id,
        });
      }

      res.json(updatedTask);
    } catch (error) {
      console.error("DEBUG: Error updating task:", error);
      res
        .status(500)
        .json({ message: "Error updating task.", error: error.message });
    }
  }
);


// --- Serve Static Files for Production ---
if (process.env.NODE_ENV === "production") {
  // Correct path: Go up one level from /Server, then into /Client/dist
  app.use(express.static(path.join(__dirname, "..", "Client", "dist")));

  // The "catchall" handler: for any request that doesn't
  // match one above, send back React's index.html file.
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "Client", "dist", "index.html"));
  });
}

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error("FATAL ERROR:", err);

  // Handle Mongoose CastErrors (invalid IDs) specifically
  if (err.name === 'CastError') {
    return res.status(400).json({
      message: `Invalid ID format: ${err.value}`,
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }

  res.status(err.status || 500).json({
    message: err.message || "An unexpected error occurred on the server.",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

app.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`)
);
