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
  origin: ["http://localhost:5173", "http://localhost:5174"],
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

      jwt.verify(token.split(" ")[1], process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          console.log("JWT verification error:", err);
          return res.sendStatus(403);
        }
        req.userId = decoded.userId;
        next();
      });
    };

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
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: "365d",
      });

      res.status(200).json({ token });
    });

    // Protect your routes using verifyJWT
    app.get("/protected", verifyJWT, (_, res) => {
      res.json({ message: "This is a protected route" });
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
