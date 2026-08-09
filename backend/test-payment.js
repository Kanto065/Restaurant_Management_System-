import SSLCommerzPayment from 'sslcommerz-lts';
import dotenv from 'dotenv';

dotenv.config();

// Test SSLCommerz sandbox connection
const testPayment = async () => {
  console.log('\n🧪 Testing SSLCommerz Sandbox Connection...\n');
  
  // Check credentials
  console.log('📋 Configuration:');
  console.log('  Store ID:', process.env.SSLCOMMERZ_STORE_ID);
  console.log('  Store Password:', process.env.SSLCOMMERZ_STORE_PASSWORD ? '***' : 'NOT SET');
  console.log('  Is Live:', process.env.SSLCOMMERZ_IS_LIVE);
  console.log('');
  
  if (!process.env.SSLCOMMERZ_STORE_ID || !process.env.SSLCOMMERZ_STORE_PASSWORD) {
    console.error('❌ Error: SSLCommerz credentials not set in .env file\n');
    console.log('Please add the following to your .env file:');
    console.log('  SSLCOMMERZ_STORE_ID=testbox');
    console.log('  SSLCOMMERZ_STORE_PASSWORD=qwerty');
    console.log('  SSLCOMMERZ_IS_LIVE=false\n');
    process.exit(1);
  }
  
  const store_id = process.env.SSLCOMMERZ_STORE_ID;
  const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
  const is_live = process.env.SSLCOMMERZ_IS_LIVE === 'true';
  
  const sslcommerz = new SSLCommerzPayment(store_id, store_passwd, is_live);
  
  // Test payment data
  const testData = {
    total_amount: 100,
    currency: 'BDT',
    tran_id: 'TEST-' + Date.now(),
    success_url: 'http://localhost:7878/api/payment/success',
    fail_url: 'http://localhost:7878/api/payment/fail',
    cancel_url: 'http://localhost:7878/api/payment/cancel',
    ipn_url: 'http://localhost:7878/api/payment/ipn',
    product_name: 'Test Order',
    product_category: 'Food',
    product_profile: 'general',
    cus_name: 'Test Customer',
    cus_email: 'customer@foodmonk.com',
    cus_add1: 'Test Address',
    cus_add2: 'N/A',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: '01700000000',
    cus_fax: '01700000000',
    ship_name: 'Test Customer',
    ship_add1: 'Test Address',
    ship_add2: 'N/A',
    ship_city: 'Dhaka',
    ship_state: 'Dhaka',
    ship_postcode: '1000',
    ship_country: 'Bangladesh',
    shipping_method: 'NO'
  };
  
  try {
    console.log('🔄 Initializing test payment...');
    const response = await sslcommerz.init(testData);
    
    console.log('\n✅ Payment Gateway Response:');
    console.log('  Status:', response.status);
    console.log('  Gateway URL:', response.GatewayPageURL);
    console.log('  Transaction ID:', testData.tran_id);
    console.log('');
    
    if (response.status === 'SUCCESS') {
      console.log('✅ SSLCommerz Sandbox is working correctly!');
      console.log('\n📝 Integration Details:');
      console.log('  • Payment initialization: ✓ Working');
      console.log('  • Gateway URL generation: ✓ Working');
      console.log('  • Callback URLs configured: ✓ Set');
      console.log('\n💡 To test full payment flow:');
      console.log('  1. Start your server: npm run dev');
      console.log('  2. Create an order via API');
      console.log('  3. Choose "online" payment method');
      console.log('  4. You will be redirected to SSLCommerz sandbox');
      console.log('  5. Use test cards provided by SSLCommerz');
      console.log('\n🔗 Test Cards: https://developer.sslcommerz.com/doc/v4/#test-cards');
      console.log('');
    } else {
      console.log('⚠️  Payment initialization returned non-SUCCESS status');
      console.log('Response:', JSON.stringify(response, null, 2));
    }
  } catch (error) {
    console.error('\n❌ Error testing payment gateway:');
    console.error('  Message:', error.message);
    
    if (error.message.includes('Invalid Store')) {
      console.log('\n💡 Possible issues:');
      console.log('  1. Store ID or password is incorrect');
      console.log('  2. Try these sandbox credentials:');
      console.log('     SSLCOMMERZ_STORE_ID=testbox');
      console.log('     SSLCOMMERZ_STORE_PASSWORD=qwerty');
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      console.log('\n💡 Network issue detected:');
      console.log('  1. Check your internet connection');
      console.log('  2. SSLCommerz API may be temporarily unavailable');
    } else {
      console.log('\n💡 For more details, check:');
      console.log('  • SSLCommerz documentation: https://developer.sslcommerz.com/');
      console.log('  • Full error:', error);
    }
    console.log('');
  }
};

testPayment();
