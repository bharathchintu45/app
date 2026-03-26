-- Create a secure RPC to fetch the true atomic server time from the database
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT now();
$$;

-- Grant execution to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_server_time() TO authenticated;
GRANT EXECUTE ON FUNCTION get_server_time() TO anon;
