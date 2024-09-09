const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const user = process.env.DB_USER;
const pass = process.env.DB_PASS;

const uri = `mongodb+srv://${user}:${pass}@cluster0.0hiczfr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const database = client.db("fundCalculatorDB");
        const fundsCollection = database.collection("funds");
        const membersCollection = database.collection("members");

        //<---middleware for verify admin--->
        const verifyAdmin = async (req, res, next) => {
            const email = req.query.email;
            const query = { "users.email": email };
            const result = await membersCollection.findOne(query);
            if (result?.role !== 'admin') {
                return res.status(401).send({ message: "Unauthorized Access" });
            }
            next();
        }

        app.post('/login', async (req, res) => {
            const { org_email, email } = req.body;
            const query = { organization_email: org_email };
            const isOrg = await membersCollection.findOne(query);
            if (!isOrg) return res.send({ message: 'Organization not found!' })
            const isUser = isOrg.users.find((user) => user?.email === email);
            if (!isUser) {
                const result = await membersCollection.updateOne(
                    { organization_email: org_email },
                    {
                        $push: {
                            users: {
                                email,
                                role: "user"
                            }
                        }
                    }
                )
                console.log(result);
            }
            res.send(isUser)
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Fund Calculator is running!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})