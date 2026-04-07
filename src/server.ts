import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import {env} from "./config/env.js"
import router from "./routes/index.js"
import { errorMiddleware } from "./middlewares/error.middleware.js"
import { notFoundMiddleware } from "./middlewares/notFound.middleware.js"
import {rateLimit} from "express-rate-limit"
import {authMiddleware} from "./middlewares/auth.middleware.js"

const app = express()


app.set("trust proxy", 1)

app.use(cors({
    allowedHeaders: ["Content-Type", "Authorization", "x-internal-key"],
    methods: ["GET", "POST",],
    origin: "*"
}))

app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // 100 requests per 15 minutes
    message: {
    json: {
        message: "Too many requests, please try again later",
        status: "error"
    },
    headers: {
        "Content-Type": "application/json",
        "Retry-After": "15",
        "x-internal-key": env.internalKey,
        "Access-Control-Allow-Origin": "*"
    }
    },
    statusCode: 429,
    standardHeaders: true,
    legacyHeaders: false,
    ipv6Subnet: 52,
    
}))

app.use(helmet())
app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))


app.use(authMiddleware)

app.use("/api/v1", router)

app.use(notFoundMiddleware)
app.use(errorMiddleware)

app.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`)
})

export default app