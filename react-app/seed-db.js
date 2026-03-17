import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing SUPABASE credentials in .env");
    process.exit(1);
}

const supabase = createClient(url, key);

// Map of base food name → image URL + short description
const FOOD_META = {
    "Oatmeal & Berries":          { image: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=600&q=80", description: "Slow-cooked rolled oats topped with seasonal berries, honey, and a sprinkle of chia seeds for a powerful antioxidant breakfast." },
    "Avocado Toast":              { image: "https://images.unsplash.com/photo-1541519227354-08fa5d50c820?w=600&q=80", description: "Multigrain toast smeared with creamy smashed avocado, sea salt, chilli flakes, and a drizzle of extra-virgin olive oil." },
    "Poha with Peanuts":          { image: "https://images.unsplash.com/photo-1630011130789-fcec01b1a0c4?w=600&q=80", description: "Light and fluffy flattened rice tossed with roasted peanuts, curry leaves, mustard seeds, and a squeeze of fresh lime." },
    "Upma Bowl":                  { image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80", description: "Classic South Indian semolina porridge cooked with vegetables, green chillies, and topped with fresh coriander." },
    "Idli & Chutney":             { image: "https://images.unsplash.com/photo-1630011135745-12b4defd2d4b?w=600&q=80", description: "Steamed fermented rice cakes served with freshly ground coconut chutney and sambar — a gut-friendly probiotic breakfast." },
    "Protein Pancakes":           { image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80", description: "Fluffy high-protein pancakes made with whey protein and banana, stacked with fresh berries and a drizzle of maple syrup." },
    "Scrambled Eggs & Toast":     { image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80", description: "Creamy soft-scrambled cage-free eggs on whole-grain toast — simple, satisfying, and packed with complete proteins." },
    "Fruit & Nut Bowl":           { image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=600&q=80", description: "A vibrant medley of fresh seasonal fruits, soaked nuts, and pumpkin seeds drizzled with a touch of raw honey." },
    "Besan Chilla":               { image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&q=80", description: "Crispy chickpea flour savoury crepe loaded with chopped vegetables and herbs — a gluten-free, high-protein morning staple." },
    "Paneer Bhurji":              { image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=80", description: "Crumbled cottage cheese scrambled with onions, tomatoes, spices, and capsicum — a protein-rich vegetarian delight." },
    "Quinoa Salad Bowl":          { image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80", description: "Fluffy quinoa tossed with cucumber, roasted chickpeas, cherry tomatoes, and a zesty lemon-tahini dressing." },
    "Grilled Chicken & Veg":      { image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&q=80", description: "Marinated grilled chicken breast served alongside a colourful medley of seasonal grilled vegetables and herbs." },
    "Dal Tadka & Brown Rice":     { image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80", description: "Comforting yellow lentil curry tempered in ghee with cumin and dried red chillies, served with nutty brown rice." },
    "Tofu Stir Fry":              { image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80", description: "Crispy pan-seared tofu cubes wok-tossed with colourful bell peppers, broccoli, and an umami soy-ginger sauce." },
    "Millet Roti & Sabzi":        { image: "https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&q=80", description: "Warm gluten-free millet flatbreads paired with a light seasonal vegetable stir-fry cooked in minimal oil." },
    "Paneer Tikka Salad":         { image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80", description: "Grilled smoky paneer cubes on a bed of mixed greens, red onion, and cucumber with a mint-yoghurt dressing." },
    "Chickpea Curry Bowl":        { image: "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=600&q=80", description: "Rich and fragrant chickpea curry slow-cooked in tomato-onion masala, served with warm whole-wheat bread." },
    "Fish Curry & Quinoa":        { image: "https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=600&q=80", description: "Coastal-style spiced fish curry in a tangy tamarind-coconut gravy, paired with protein-packed fluffy quinoa." },
    "Whole Wheat Pasta":          { image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80", description: "Al-dente whole wheat pasta tossed in a rich basil-tomato sauce with roasted garlic and seasonal vegetables." },
    "Rajma Bowl":                 { image: "https://images.unsplash.com/photo-1585703900468-13c7a978ad86?w=600&q=80", description: "Hearty kidney bean curry braised in a deep onion-tomato gravy, served over fluffy basmati for a satisfying meal." },
    "Light Millet Soup":          { image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80", description: "A warm, nourishing millet and vegetable broth seasoned with herbs — light on calories but rich in minerals and fibre." },
    "Grilled Fish & Broccoli":    { image: "https://images.unsplash.com/photo-1485921325833-c519793a4003?w=600&q=80", description: "Perfectly grilled fish fillet seasoned with herbs and lemon, alongside tender steamed broccoli florets." },
    "Moong Dal Khichdi":         { image: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&q=80", description: "Comforting one-pot yellow lentil and rice porridge tempered with ghee, cumin, and ginger — ideal for easy digestion." },
    "Chicken Stew":               { image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80", description: "Tender slow-cooked chicken in a mild coconut milk broth with carrots, potatoes, and whole spices." },
    "Zucchini Noodles":           { image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80", description: "Spiralised zucchini noodles tossed with a vibrant pesto sauce, cherry tomatoes, and toasted pine nuts — low-carb and delicious." },
    "Mushroom Sabzi & Phulka":    { image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80", description: "Earthy button mushrooms cooked in a spiced dry masala served with light handmade whole-wheat phulkas." },
    "Baked Tofu Bowl":            { image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80", description: "Oven-baked marinated tofu cubes served over a bed of greens with sesame dressing and crunchy sunflower seeds." },
    "Clear Veg Soup & Salad":     { image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80", description: "A gentle clear vegetable broth packed with seasonal vegetables, paired with a crisp garden salad." },
    "Egg Curry & Rice":            { image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&q=80", description: "Boiled eggs simmered in a flavorful onion-tomato curry, served alongside steamed basmati for a satisfying dinner." },
    "Lentil Soup":                { image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80", description: "Slow-simmered red lentil soup with cumin, coriander, and a squeeze of lemon — simple, warming, and deeply nutritious." },
    "Roasted Makhana":            { image: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&q=80", description: "Air-popped fox nuts roasted in ghee with a light seasoning of pink salt and chaat masala — a guilt-free crunchy snack." },
    "Sprout Salad":               { image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80", description: "A crunchy mix of fresh mixed sprouts, diced cucumber, tomato, and onion with a lime and chaat masala dressing." },
    "Greek Yogurt":               { image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80", description: "Thick, creamy strained yoghurt packed with probiotics and live cultures — high in protein and great for gut health." },
    "Boiled Chana":               { image: "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=600&q=80", description: "Tender boiled black chickpeas tossed with onion, green chilli, coriander, and a dash of chaat masala." },
    "Mixed Nuts":                 { image: "https://images.unsplash.com/photo-1626200411757-00ac20a49c94?w=600&q=80", description: "A premium mix of almonds, walnuts, cashews, and pistachios — rich in healthy fats, protein, and essential minerals." },
  };
  
  function getMeta(baseName) {
    for (const key of Object.keys(FOOD_META)) {
      if (baseName.startsWith(key)) return FOOD_META[key];
    }
    return { image: "", description: "A healthy, chef-prepared meal made with fresh seasonal ingredients, crafted to support your nutritional goals." };
  }
  
  // Generating the 100 items from the original menu.ts logic
  const DEFAULT_MENU = [
    ...Array.from({ length: 25 }, (_, i) => {
      const baseName = [
        "Oatmeal & Berries", "Avocado Toast", "Poha with Peanuts", "Upma Bowl",
        "Idli & Chutney", "Protein Pancakes", "Scrambled Eggs & Toast", "Fruit & Nut Bowl",
        "Besan Chilla", "Paneer Bhurji",
      ][i % 10];
      const meta = getMeta(baseName);
      return {
        id: `B-${i + 1}`,
        category: "Breakfast",
        name: baseName + ` Variant ${Math.floor(i / 10) + 1}`,
        description: meta.description,
        image_url: meta.image,
        calories: 250 + (i % 5) * 20,
        protein: 10 + (i % 3) * 5,
        carbs: 30 + (i % 4) * 5,
        fat: 8 + (i % 2) * 2,
        fiber: 5 + (i % 3),
        price_inr: 120 + (i % 5) * 10,
      };
    }),
    ...Array.from({ length: 30 }, (_, i) => {
      const baseName = [
        "Quinoa Salad Bowl", "Grilled Chicken & Veg", "Dal Tadka & Brown Rice", "Tofu Stir Fry",
        "Millet Roti & Sabzi", "Paneer Tikka Salad", "Chickpea Curry Bowl",
        "Fish Curry & Quinoa", "Whole Wheat Pasta", "Rajma Bowl",
      ][i % 10];
      const meta = getMeta(baseName);
      return {
        id: `L-${i + 1}`,
        category: "Lunch",
        name: baseName + ` Variant ${Math.floor(i / 10) + 1}`,
        description: meta.description,
        image_url: meta.image,
        calories: 400 + (i % 5) * 30,
        protein: 20 + (i % 4) * 8,
        carbs: 45 + (i % 5) * 5,
        fat: 12 + (i % 3) * 3,
        fiber: 8 + (i % 4),
        price_inr: 250 + (i % 5) * 20,
      };
    }),
    ...Array.from({ length: 30 }, (_, i) => {
      const baseName = [
        "Light Millet Soup", "Grilled Fish & Broccoli", "Moong Dal Khichdi", "Chicken Stew",
        "Zucchini Noodles", "Mushroom Sabzi & Phulka", "Baked Tofu Bowl",
        "Clear Veg Soup & Salad", "Egg Curry & Rice", "Lentil Soup",
      ][i % 10];
      const meta = getMeta(baseName);
      return {
        id: `D-${i + 1}`,
        category: "Dinner",
        name: baseName + ` Variant ${Math.floor(i / 10) + 1}`,
        description: meta.description,
        image_url: meta.image,
        calories: 300 + (i % 5) * 20,
        protein: 18 + (i % 4) * 5,
        carbs: 35 + (i % 5) * 5,
        fat: 10 + (i % 3) * 2,
        fiber: 7 + (i % 3),
        price_inr: 200 + (i % 5) * 15,
      };
    }),
    ...Array.from({ length: 15 }, (_, i) => {
      const baseName = [
        "Roasted Makhana", "Sprout Salad", "Greek Yogurt", "Boiled Chana", "Mixed Nuts",
      ][i % 5];
      const meta = getMeta(baseName);
      return {
        id: `S-${i + 1}`,
        category: "Snack",
        name: baseName + ` Variant ${Math.floor(i / 5) + 1}`,
        description: meta.description,
        image_url: meta.image,
        calories: 150 + (i % 3) * 20,
        protein: 5 + (i % 3) * 3,
        carbs: 15 + (i % 3) * 5,
        fat: 6 + (i % 2) * 2,
        fiber: 3 + (i % 2),
        price_inr: 80 + (i % 3) * 10,
      };
    }),
  ];

  async function seedDatabase() {
    console.log(`Starting to insert ${DEFAULT_MENU.length} menu items into Supabase 'menu_items' table...`);

    // Using anon key, so depends on RLS policy. 
    // We already have a safe "select" policy but might need to bypass for insertion if RLS is on for inserts?
    // Let's run the raw insert, if it fails due to RLS, I will use Service Role Key or tell user
    const { error } = await supabase.from('menu_items').upsert(DEFAULT_MENU, { onConflict: 'id' });

    if (error) {
        console.error("❌ Failed to insert menu items:", error.message);
        // Fallback: Generate the SQL script directly
        console.log("\nGenerating fallback SQL script instead...");
        const fs = await import('fs');
        let sql = "-- FALLBACK SEED SCRIPT FOR MENU ITEMS\n\n";
        
        DEFAULT_MENU.forEach(item => {
            const desc = item.description.replace(/'/g, "''");
            const name = item.name.replace(/'/g, "''");
            sql += `INSERT INTO public.menu_items (id, category, name, description, image_url, calories, protein, carbs, fat, fiber, price_inr) VALUES ('${item.id}', '${item.category}', '${name}', '${desc}', '${item.image_url}', ${item.calories}, ${item.protein}, ${item.carbs}, ${item.fat}, ${item.fiber}, ${item.price_inr}) ON CONFLICT (id) DO UPDATE SET price_inr = EXCLUDED.price_inr;\n`;
        });
        
        fs.writeFileSync('seed_menu.sql', sql);
        console.log("✅ Wrote raw SQL to d:\\TFB\\react-app\\seed_menu.sql");

    } else {
        console.log("✅ Successfully inserted all menu items directly into Supabase!");
    }
  }

  seedDatabase();
