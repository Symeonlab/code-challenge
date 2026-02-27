/**
 * RECENT DATA SYNC SCRIPT
 * ----------------------
 * 1. Read ISO codes from local JSON.
 * 2. Fetch data from Heroku API.
 * 3. Filter for specific country.
 * 4. Create customers in Stripe.
 */

const fs = require('fs');
const Stripe = require('stripe');


// Ref: https://docs.stripe.com/api/authentication
const stripe = Stripe('sk_test_51MEuPXA69JWLHl3Jxw3gKWTtXJCOkzmvjDs5oJ45DZEHFzo5HLz5JfWkNvzU03eCyo0ojkiW2ot6WXA8udWEkh0300nAnoJmcj');
const API_KEY = 'pk_7f8a9b2c4d6e1f3a5b8c9d0e2f4a6b7c';
const URL = 'https://ops-challenge-f4e887b4ef3a.herokuapp.com/data';

async function sync(targetCountry) {
  try {
    // 1. Get the 2-letter ISO code (Required by Stripe address object)
    // Ref: https://docs.stripe.com/api/customers/object#customer_object-address-country
    const countryData = JSON.parse(fs.readFileSync('./countries-ISO3166.json'));
    const isoCode = Object.entries(countryData).find(([code, name]) => name.toLowerCase() === targetCountry.toLowerCase())?.[0];

    if (!isoCode) throw new Error(`ISO code not found for ${targetCountry}`);

    // 2. Fetch customers from the endpoint
    const response = await fetch(`${URL}?api_key=${API_KEY}`);
    const rawData = await response.json();
    const allCustomers = Array.isArray(rawData) ? rawData : rawData.data;

    // 3. Filter for the specific country and map to Stripe creation calls
    const targetCustomers = allCustomers.filter(c => c.country.toLowerCase() === targetCountry.toLowerCase());

    console.log(`Syncing ${targetCustomers.length} customers to Stripe...`);

    // 4. Create customers in Stripe (The "Load" phase)
    // Ref: https://docs.stripe.com/api/customers/create
    const results = await Promise.all(targetCustomers.map(async (person) => {
      const stripeCustomer = await stripe.customers.create({
        email: person.email,
        name: `${person.firstName} ${person.lastName}`,
        address: { country: isoCode }
      });

      return {
        email: stripeCustomer.email,
        stripe_id: stripeCustomer.id,
        country: isoCode
      };
    }));

    // 5. Save results to file
    fs.writeFileSync('final-customers.json', JSON.stringify(results, null, 2));
    console.log('Success! Check final-customers.json');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Start the process
sync('Spain');