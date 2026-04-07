import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import {env} from "./config/env.js"
import router from "./routes/index.js"

const app = express()

app.use(cors())
app.use(helmet())
app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))


app.use("/api/v1", router)

app.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`)
})

export default app