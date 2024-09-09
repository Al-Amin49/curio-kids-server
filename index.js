const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

const port = process.env.PORT || 8000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ikm0tqz.mongodb.net`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {

    const coursesCollection = client.db("curiokids").collection("courses");
    //get all Courses
    app.get("/courses", async (req, res) => {
        const cursor = coursesCollection.find();
        const courses = await cursor.toArray();
        res.send(courses);
      });

      app.post('/courses', async (req, res) => {
        const course = req.body;
        const result = await coursesCollection.insertOne(course);
        res.send(result);
      });
   

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from Curio Kids Server..')
})

app.listen(port, () => {
  console.log(`Curio Kids is running on port ${port}`)
})