const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 8000;

// middleware
const corsOptions = {
  origin: ["http://localhost:3000", "https://curio-kids-eta.vercel.app"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ikm0tqz.mongodb.net`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const coursesCollection = client.db("curiokids").collection("courses");
    const teachersCollection = client.db("curiokids").collection("teachers");
    const usersCollection = client.db("curiokids").collection("users");

    // Verify JWT (middleware)
    const verifyJWT = (req, res, next) => {
      const token = req.headers["authorization"];

      if (!token) return res.sendStatus(403);

      jwt.verify(
        token.split(" ")[1],
        process.env.JWT_SECRET,
        (err, decoded) => {
          if (err) {
            console.log("JWT verification error:", err);
            return res.sendStatus(403);
          }
          req.userId = decoded.userId;
          next();
        }
      );
    };

// Select a course
app.post("/courses/select", verifyJWT, async (req, res) => {
  const { courseId } = req.body;
  
  // Check if the course exists
  const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  // Add the course to the user's selected courses
  const result = await usersCollection.updateOne(
    { _id: new ObjectId(req.userId) },
    { $addToSet: { selectedCourses: courseId } }
  );

  res.status(200).json({ message: "Course selected successfully", result });
});

// Fetch selected courses for the user
app.get("/courses/selected", verifyJWT, async (req, res) => {
  const user = await usersCollection.findOne({ _id: new ObjectId(req.userId) });
  if (!user || !user.selectedCourses) {
    return res.status(404).json({ message: "No courses selected" });
  }

  // Fetch selected course details
  const selectedCourses = await coursesCollection
    .find({ _id: { $in: user.selectedCourses.map(id => new ObjectId(id)) } })
    .toArray();

  res.status(200).json(selectedCourses);
});

// Delete a selected course
app.delete("/courses/remove", verifyJWT, async (req, res) => {
  const { courseId } = req.body;

  // Remove the course from the user's selected courses
  const result = await usersCollection.updateOne(
    { _id: new ObjectId(req.userId) },
    { $pull: { selectedCourses: courseId } }
  );

  res.status(200).json({ message: "Course removed successfully", result });
});

    //auth

    app.post("/register", async (req, res) => {
      const { name, email, password } = req.body;

      // Check if the user already exists
      const userExists = await usersCollection.findOne({ email });
      if (userExists) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a new user
      const newUser = {
        name,
        email,
        password: hashedPassword,
        role: "user",
        profilePicture:
          "https://i.ibb.co.com/7gtdY9x/pngtree-cartoon-style-female-user-profile-icon-vector-illustraton-png-image-6489286.png",
      };

      // Insert the user into the database
      const result = await usersCollection.insertOne(newUser);

      res.status(201).json({ result, message: "User registered successfully" });
    });

    // Login User
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      // Find the user by email
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Check if the password is correct
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Generate JWT
      const token = jwt.sign({ 
        userId: user._id,
        name:user.name,
        email:user.email,
        role:user?.role,
        profilePicture:user.profilePicture
        
      }, process.env.JWT_SECRET, {
        expiresIn: "365d",
      });

      res.status(200).json({ token });
    });

    // Protect your routes using verifyJWT
    app.get("/protected", verifyJWT, async(req, res) => {
      const user = await usersCollection.findOne({ _id: new ObjectId(req.userId) });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',  
    profilePicture: user.profilePicture || null,
  });
    });

    // Courses
    app.get("/courses", async (req, res) => {
      const cursor = coursesCollection.find();
      const courses = await cursor.toArray();
      res.send(courses);
    });

    app.post("/courses", async (req, res) => {
      const course = req.body;
      const result = await coursesCollection.insertOne(course);
      res.send(result);
    });

    //teachers

    app.get("/teachers", async (req, res) => {
      const cursor = teachersCollection.find();
      const teachers = await cursor.toArray();
      res.send(teachers);
    });

    app.post("/teachers", async (req, res) => {
      const teacher = req.body;
      const result = await teachersCollection.insertOne(teacher);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Curio Kids Server..");
});

app.listen(port, () => {
  console.log(`Curio Kids is running on port ${port}`);
});
