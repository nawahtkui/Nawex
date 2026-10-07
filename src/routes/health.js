import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
res.json({
ok: true,
service: "nawex",
version: "0.1.0",
time: new Date().toISOString()
});
});

export default router;
