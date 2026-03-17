-- Create app_settings table for global feature toggles
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'true'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default: chat enabled
INSERT INTO app_settings (key, value) 
VALUES ('chat_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Allow authenticated users to read settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update settings" ON app_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can insert settings" ON app_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
