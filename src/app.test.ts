import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("Exploration Notes API", () => {
  it("reports health", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("starts with no notes", async () => {
    const app = createApp();
    const res = await request(app).get("/api/notes");
    expect(res.status).toBe(200);
    expect(res.body.notes).toEqual([]);
  });

  it("creates and lists a note", async () => {
    const app = createApp();
    const created = await request(app)
      .post("/api/notes")
      .send({ text: "explore the environment" });
    expect(created.status).toBe(201);
    expect(created.body.note.text).toBe("explore the environment");

    const listed = await request(app).get("/api/notes");
    expect(listed.body.notes).toHaveLength(1);
    expect(listed.body.notes[0].text).toBe("explore the environment");
  });

  it("rejects an empty note", async () => {
    const app = createApp();
    const res = await request(app).post("/api/notes").send({ text: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/i);
  });
});
