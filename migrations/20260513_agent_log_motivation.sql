-- Add motivation column to agent_log for Lehkost Agent personalized messages
ALTER TABLE agent_log ADD COLUMN IF NOT EXISTS motivation text;
