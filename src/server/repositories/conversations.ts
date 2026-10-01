import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { conversations, messages, type MessageCitation } from "@/server/db/schema";

export async function listConversations(userId: string, limit = 12) {
  return getDb()
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

export async function getConversation(id: string, userId: string) {
  const [conv] = await getDb()
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  if (!conv) return null;
  const msgs = await getDb().select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  return { ...conv, messages: msgs };
}

/** Appends a question/answer pair, creating the conversation if needed. Returns its id. */
export async function appendExchange(args: {
  userId: string;
  conversationId?: string;
  question: string;
  answer: string;
  citations: MessageCitation[];
}): Promise<string> {
  const db = getDb();
  return db.transaction(async (tx) => {
    let id = args.conversationId;
    if (id) {
      const [owned] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, args.userId)))
        .limit(1);
      if (!owned) id = undefined;
    }
    if (!id) {
      const [created] = await tx
        .insert(conversations)
        .values({ userId: args.userId, title: args.question.slice(0, 80) })
        .returning({ id: conversations.id });
      id = created!.id;
    } else {
      await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, id));
    }
    const now = Date.now();
    await tx.insert(messages).values([
      { conversationId: id, role: "user", content: args.question, createdAt: new Date(now) },
      { conversationId: id, role: "assistant", content: args.answer, citations: args.citations, createdAt: new Date(now + 1) },
    ]);
    return id;
  });
}
