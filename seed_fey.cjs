const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lusbaxesfvicoibnvjcr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1c2JheGVzZnZpY29pYm52amNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI3NTQ0MSwiZXhwIjoyMDg3ODUxNDQxfQ.ouwvfCjIv7tfOndX4gxE0iV3t89ypm0MlWijr-nmvIM'
);

const OWNER_ID = '8922c4e7-0574-4615-a919-af07241862fa';

async function seed() {
  console.log("Fetching restaurant...");
  const { data: rest, error: rErr } = await supabase.from('restaurants').select('*').eq('owner_id', OWNER_ID).single();
  
  if (rErr) return console.error("Error fetching restaurant:", rErr);
  if (!rest) return console.error("Restaurant not found for this user!");
  
  console.log("Updating restaurant settings...");
  await supabase.from('restaurants').update({
    table_count: 15,
    short_code: 'FEY'
  }).eq('id', rest.id);

  console.log("Deleting old menu items (if any)...");
  await supabase.from('menu_items').delete().eq('restaurant_id', rest.id);

  console.log("Seeding menu items...");
  const menuItems = [
    {
      restaurant_id: rest.id,
      name: 'Smoky Party Jollof Rice',
      description: 'Authentic Nigerian party jollof rice served with fried plantain and your choice of protein.',
      price: 3500,
      category: 'Mains'
    },
    {
      restaurant_id: rest.id,
      name: 'Pounded Yam & Egusi Soup',
      description: 'Soft pounded yam served with rich Egusi soup loaded with assorted meat and stock fish.',
      price: 5000,
      category: 'Mains'
    },
    {
      restaurant_id: rest.id,
      name: 'Spicy Beef Suya',
      description: 'Thinly sliced grilled beef, marinated in spicy suya yaji pepper mix. Served with fresh onions.',
      price: 2500,
      category: 'Starters'
    },
    {
      restaurant_id: rest.id,
      name: 'Chilled Zobo Drink',
      description: 'Refreshing hibiscus drink brewed with ginger, pineapple and cloves. Served ice cold.',
      price: 1000,
      category: 'Drinks'
    },
    {
      restaurant_id: rest.id,
      name: 'Chapman',
      description: 'Classic Nigerian mocktail with Angostura bitters, cucumber, lemon and grenadine.',
      price: 2000,
      category: 'Drinks'
    }
  ];

  const { error: insertErr } = await supabase.from('menu_items').insert(menuItems);
  if (insertErr) return console.error("Error inserting menu items:", insertErr);

  console.log("Seeding complete! Restaurant is ready for testing.");
}

seed();
