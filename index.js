const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 8000;

app.use(cors());

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

    // Role-based authorization middleware
const verifyRole = (roles) => {
  return (req, res, next) => {
    if (!req.userId) return res.sendStatus(403);

    usersCollection.findOne({ _id: new ObjectId(req.userId) })
      .then(user => {
        if (!user || !roles.includes(user.role)) {
          return res.sendStatus(403);
        }
        next();
      })
      .catch(err => {
        console.error("Role verification error:", err);
        res.sendStatus(403);
      });
  };
};


// Select a course
app.post("/courses/select", verifyJWT, async (req, res) => {
  const { courseId } = req.body;
  
  // Check if the course exists
  const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });
  // if (!course) {
  //   return res.status(404).json({ message: "Course not found" });
  // }

   // Check if the course is already selected by the user
  const user = await usersCollection.findOne({ _id: new ObjectId(req.userId) });
  
  if (user?.selectedCourses?.includes(courseId)) {
    return res.status(400).json({ message: "Course already selected" });
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
app.delete("/courses/remove/:id", verifyJWT, async (req, res) => {
  const courseId = req.params.id;

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

    //get AllUsers
    app.get("/allusers",verifyJWT, verifyRole(['admin']), async (req, res) => {
      const cursor = usersCollection.find();
      const allusers = await cursor.toArray();
      res.send(allusers);
    });

    // Courses
    app.get("/courses", async (req, res) => {
      const cursor = coursesCollection.find();
      const courses = await cursor.toArray();
      res.send(courses);
    });
    //approved courses
    app.get("/courses/approved", async (req, res) => {
      try {
        // Fetch only courses with status 'approved'
        const approvedCourses = await coursesCollection.find({ status: "approved" }).toArray();
    
        // Send the approved courses as a response
        res.status(200).json(approvedCourses);
      } catch (error) {
        console.error("Error fetching approved courses:", error);
        res.status(500).json({ message: "Failed to fetch approved courses" });
      }
    });

   // Add a new course (Instructor)
// app.post("/courses", verifyJWT, verifyRole(["instructor"]), async (req, res) => {
//   const course = req.body;
//   course.status = "pending";  
//   course.feedback = "";
//   course.instructorId = req.userId;  

//   const result = await coursesCollection.insertOne(course);
//   res.status(201).json({ message: "Course added successfully", result });
// });

app.post("/courses", verifyJWT, verifyRole(["instructor"]), async (req, res) => {
  const { title, description, age, time, seat, price, img, video } = req.body;  
  const instructorId = req.userId;

  // Prepare the new course object
  const course = {
    title,
    description,
    age,
    time,
    seat,
    price,
    img,
    video,
    status: "pending", // Default status
    feedback: null,    // Initial feedback is null
    instructorId,      // The instructor's ID from JWT
  };

  try {
    // Insert the new course into the collection
    const result = await coursesCollection.insertOne(course);

    // After successfully adding the course, update the instructor's class info
    const updateInstructor = await usersCollection.updateOne(
      { _id: new ObjectId(instructorId) },
      {
        $inc: { numberOfClasses: 1 },            // Increment the class count
        $addToSet: { classesTaught: title }      // Add the class name to the instructor's list
      }
    );

    res.status(201).json({
      message: "Course added and instructor updated successfully",
      courseResult: result,
      instructorUpdate: updateInstructor,
    });
  } catch (error) {
    console.error("Error adding course or updating instructor:", error);
    res.status(500).json({ message: "Failed to add course or update instructor" });
  }
});


// Get courses by instructor (Instructor's My Classes)
app.get("/instructor/courses", verifyJWT, verifyRole(["instructor"]), async (req, res) => {
  const courses = await coursesCollection.find({ instructorId: req.userId }).toArray();
  res.status(200).json(courses);
});

// Delete a course by ID (Instructor's My Classes)
app.delete("/courses/:id", verifyJWT, verifyRole(["instructor"]), async (req, res) => {
  const courseId = req.params.id;
  const instructorId = req.userId;

  try {
    // Find the course by ID
    const course = await coursesCollection.findOne({ _id: courseId });

    // Check if the course exists and if it belongs to the instructor
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.instructorId !== instructorId) {
      return res.status(403).json({ message: "You are not authorized to delete this course" });
    }

    // Delete the course
    await coursesCollection.deleteOne({ _id: courseId });

    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ message: "Failed to delete course" });
  }
});



//admin update course status
app.patch("/admin/courses/:id", verifyJWT, verifyRole(["admin"]), async (req, res) => {
  const { status, feedback } = req.body;  
  const result = await coursesCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status, feedback } }
  );

  res.status(200).json({ message: `Course ${status} successfully`, result });
});

// When promoting a user to instructor, add designation and socialLinks
app.patch("/admin/users/role/:id", verifyJWT, verifyRole(["admin"]), async (req, res) => {
  const userId = req.params.id;
  const { role, designation, socialLinks } = req.body; // Extend to accept designation and socialLinks

  // Validate role input
  if (!["instructor", "admin"].includes(role)) {
    return res.status(400).json({ message: "Invalid role. Choose 'instructor' or 'admin'." });
  }

  try {
    // Find and update the user's role
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          role,
          ...(role === 'instructor' && { designation, socialLinks }), // Only add if user is promoted to instructor
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: `User role updated to ${role} successfully`, result });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




    //teachers

    app.get("/teachers", async (req, res) => {
      const cursor = teachersCollection.find();
      const teachers = await cursor.toArray();
      res.send(teachers);
    });
    app.get('/instructors', async (req, res) => {
      try {
        // Fetch all instructors
        const instructors = await usersCollection.find({ role: "instructor" }).toArray();
    
        // For each instructor, fetch their classes and calculate the number of classes
        const instructorsWithClasses = await Promise.all(instructors.map(async (instructor) => {
          // Fetch the classes for this instructor
          const classes = await coursesCollection.find({
             instructorId: instructor._id,
             status:'approved'
             }).toArray();
    
          // Extract class names
          const name_of_classes = classes.map(course => course.className);
          
          return {
            ...instructor,
            number_of_classes: classes.length,
            name_of_classes,
          };
        }));
    
        res.status(200).json(instructorsWithClasses);
      } catch (error) {
        console.error("Error fetching instructors with classes:", error);
        res.status(500).json({ message: "Failed to fetch instructors with classes" });
      }
    })

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
