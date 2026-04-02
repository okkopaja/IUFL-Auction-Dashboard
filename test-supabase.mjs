import { createClient } from "@supabase/supabase-js";

const url = "https://qcgkwnrtegwudsrtqqvy.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

console.log("Service key set:", !!serviceKey);
console.log("Service key starts with:", serviceKey?.substring(0, 20));
console.log("Publishable key set:", !!publishableKey);

// Test with service role key
console.log("\n--- Testing with SERVICE ROLE key ---");
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
try {
  const { data, error } = await admin.from("Team").select("id, name").limit(2);
  if (error) {
    console.log("ERROR:", error.code, error.message);
  } else {
    console.log("SUCCESS! Teams:", data);
  }
} catch (e) {
  console.log("EXCEPTION:", e.message);
}

// Test with publishable key
console.log("\n--- Testing with PUBLISHABLE key ---");
const anon = createClient(url, publishableKey, {
  auth: { persistSession: false },
});
try {
  const { data, error } = await anon.from("Team").select("id, name").limit(2);
  if (error) {
    console.log("ERROR:", error.code, error.message);
  } else {
    console.log("SUCCESS! Teams:", data);
  }
} catch (e) {
  console.log("EXCEPTION:", e.message);
}
