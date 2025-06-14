import { 
  profiles, 
  conversations, 
  messages,
  type Profile, 
  type InsertProfile,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage 
} from "@shared/schema";
import { eq, or, desc, and, sql } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // Profile/User methods
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  getProfileByUsername(username: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | undefined>;
  
  // Conversation methods
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationsForUser(userId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  
  // Message methods
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesForConversation(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined>;
  
  // Legacy compatibility
  getUser(id: string): Promise<Profile | undefined>;
  getUserByUsername(email: string): Promise<Profile | undefined>;
  createUser(user: InsertProfile): Promise<Profile>;
}

export class DatabaseStorage implements IStorage {
  // Profile methods
  async getProfile(id: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return result[0];
  }

  async getProfileByEmail(email: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    return result[0];
  }

  async getProfileByUsername(username: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.username, username)).limit(1);
    return result[0];
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const result = await db.insert(profiles).values(profile).returning();
    return result[0];
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | undefined> {
    const result = await db.update(profiles)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    return result[0];
  }

  // Conversation methods
  async getConversation(id: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return result[0];
  }

  async getConversationsForUser(userId: string): Promise<Conversation[]> {
    const result = await db.select({
      id: conversations.id,
      participant_1: conversations.participant_1,
      participant_2: conversations.participant_2,
      created_at: conversations.created_at,
      updated_at: conversations.updated_at,
      // Get the other participant's details
      other_participant: {
        id: profiles.id,
        username: profiles.username,
        email: profiles.email,
        full_name: profiles.full_name,
        avatar_url: profiles.avatar_url,
        created_at: profiles.created_at,
        updated_at: profiles.updated_at
      }
    })
    .from(conversations)
    .leftJoin(profiles, or(
      and(eq(conversations.participant_1, profiles.id), eq(conversations.participant_2, userId)),
      and(eq(conversations.participant_2, profiles.id), eq(conversations.participant_1, userId))
    ))
    .where(or(
      eq(conversations.participant_1, userId),
      eq(conversations.participant_2, userId)
    ))
    .orderBy(desc(conversations.updated_at));
    
    return result.map(row => ({
      id: row.id,
      participant_1: row.participant_1,
      participant_2: row.participant_2,
      created_at: row.created_at,
      updated_at: row.updated_at,
      other_participant: row.other_participant
    }));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(conversation).returning();
    return result[0];
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const result = await db.update(conversations)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return result[0];
  }

  // Message methods
  async getMessage(id: string): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return result[0];
  }

  async getMessagesForConversation(conversationId: string): Promise<Message[]> {
    const result = await db.select()
      .from(messages)
      .where(eq(messages.conversation_id, conversationId))
      .orderBy(messages.created_at);
    return result;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(message).returning();
    return result[0];
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const result = await db.update(messages)
      .set(updates)
      .where(eq(messages.id, id))
      .returning();
    return result[0];
  }

  // Legacy compatibility methods
  async getUser(id: string): Promise<Profile | undefined> {
    return this.getProfile(id);
  }

  async getUserByUsername(email: string): Promise<Profile | undefined> {
    return this.getProfileByEmail(email);
  }

  async createUser(user: InsertProfile): Promise<Profile> {
    return this.createProfile(user);
  }
}

export const storage = new DatabaseStorage();
