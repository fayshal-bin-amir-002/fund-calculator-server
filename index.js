const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
            const { email, org_email } = req.query;
            const query = { organization_email: org_email };
            const result = await membersCollection.findOne(query);
            const isAdmin = result.users.find((u) => u.email === email);

            if (isAdmin?.role !== 'admin') {
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
                const user = {
                    email,
                    role: "user"
                }
                await membersCollection.updateOne(
                    { organization_email: org_email },
                    {
                        $push: {
                            users: user
                        }
                    }
                )
                res.send({ user, org_email })
                return;
            }
            const user = isOrg.users.find((user) => user?.email === email);
            res.send({ user, org_email })
        })

        app.get("/transactions", async (req, res) => {
            const date = req.query.date;
            const org_email = req.query.org_email;
            const organization = await fundsCollection.findOne({
                organization_email: org_email,
                time: date
            });
            if (!organization) {
                return res.send([]);
            }
            res.send(organization.transactions);
        })

        app.post("/add-transactions", verifyAdmin, async (req, res) => {
            const trans = req.body;
            const { date, org_email } = req.query;

            const newTransactionObj = {
                _id: new ObjectId(),
                text: trans.text,
                amount: trans.amount,
                type: trans.type
            };

            const organization = await fundsCollection.findOne({
                organization_email: org_email,
                time: date
            });

            if (!organization) {
                await fundsCollection.insertOne({
                    organization_email: org_email,
                    time: date,
                    transactions: [newTransactionObj]
                })
            } else {
                await fundsCollection.updateOne(
                    {
                        organization_email: org_email,
                        time: date
                    },
                    {
                        $push: {
                            transactions: newTransactionObj
                        }
                    }
                )
            }
            res.send(newTransactionObj);
        })

        app.patch("/edit-transactions", verifyAdmin, async (req, res) => {
            const trans = req.body;
            const { date, org_email } = req.query;
            const organization = await fundsCollection.findOne({
                organization_email: org_email,
                time: date
            });

            const result = await fundsCollection.findOneAndUpdate(
                {
                    organization_email: org_email,
                    time: date,
                    "transactions._id": new ObjectId(trans.id)
                },
                {
                    $set: {
                        "transactions.$.text": trans.text,
                        "transactions.$.amount": trans.amount,
                        "transactions.$.type": trans.type
                    }
                },
                {
                    returnDocument: "after",
                }
            );

            const updatedTransactionObj = result.transactions.find(
                (transaction) => transaction._id.toString() === trans?.id
            );

            res.send(updatedTransactionObj);
        })

        app.delete("/delete-transactions/:id", verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const { date, org_email } = req.query;

            const result = await fundsCollection.updateOne(
                {
                    organization_email: org_email,
                    time: date
                },
                {
                    $pull: { transactions: { _id: new ObjectId(id) } }
                }
            );
            res.send(id);
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