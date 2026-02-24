const axios = require('axios');
async function test() {
    try {
        console.log("Registering user...", new Date());
        const timestamp = Date.now();
        const email = `test_dashboard_${timestamp}@test.com`;
        
        let res = await axios.post('http://127.0.0.1:8000/auth/register', {
            email: email,
            password: "TestPassword123!",
            full_name: "Tester",
            role: "tenant"
        });
        
        console.log("Logging in...", new Date());
        let loginFormData = new URLSearchParams();
        loginFormData.append('username', email);
        loginFormData.append('password', "TestPassword123!");
        
        res = await axios.post('http://127.0.0.1:8000/auth/login', loginFormData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const token = res.data.access_token;
        console.log("Token:", token.substring(0, 10) + "...");
        
        console.log("Fetching /auth/me ...", new Date());
        let meRes = await axios.get('http://127.0.0.1:8000/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Me status:", meRes.status);
        
        console.log("Fetching /auth/me/segment-config ...", new Date());
        let segmentRes = await axios.get('http://127.0.0.1:8000/auth/me/segment-config', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Segment config status:", segmentRes.status);
        console.log("Done checking APIs!", new Date());

    } catch(err) {
        console.error("FAILED ERROR", err.response?.status, err.response?.data || err.message);
    }
}
test();
