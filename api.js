const axios = require('axios');

export default async function handler(req, res) {
    const { number } = req.query;

    if (!number || !/^[0-9]{11,13}$/.test(number)) {
        return res.status(400).json({ error: "Invalid Input" });
    }

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    // Function to fetch from APIs
    async function fetchApi(url) {
        try {
            const response = await axios.get(url, {
                timeout: 20000,
                headers: { 'User-Agent': userAgent },
                validateStatus: () => true // Don't throw on 403/404
            });
            
            let data = response.data;
            
            // If response is a string (garbage + JSON), clean it
            if (typeof data === 'string') {
                const start = data.indexOf('{');
                const end = data.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    data = JSON.parse(data.substring(start, end + 1));
                }
            }
            return data;
        } catch (e) {
            return null;
        }
    }

    let names = new Set();
    let cnics = new Set();
    let addresses = new Set();
    let numbersList = new Set();

    // Primary URLs
    const urls = [
        `https://omrsite.com/api.php?number=${number}`,
        `https://paksimdetails.xyz/Vigo//A/newnapi/example.php?type=mobile&search=${number}`
    ];

    let foundAny = false;

    for (const [index, url] of urls.entries()) {
        const result = await fetchApi(url);
        if (result) {
            if (index === 0) { // omrsite.com logic
                if (result.name) { names.add(result.name.trim()); foundAny = true; }
                if (result.cnic) { cnics.add(result.cnic); foundAny = true; }
                if (result.address) { addresses.add(result.address.trim()); foundAny = true; }
                if (result.numbers) result.numbers.forEach(n => numbersList.add(n));
            } else { // paksimdetails.xyz logic
                if (Array.isArray(result)) {
                    result.forEach(r => {
                        if (r.nam) { names.add(r.nam.trim()); foundAny = true; }
                        if (r.cni) { cnics.add(r.cni); foundAny = true; }
                        if (r.adr) { addresses.add(r.adr.trim()); foundAny = true; }
                        if (r.nbr) { numbersList.add(r.nbr); foundAny = true; }
                    });
                }
            }
        }
    }

    // Step 2: CNIC Expansion logic
    if (foundAny && cnics.size > 0 && number.length === 11) {
        const firstCnic = [...cnics][0];
        const res2 = await fetchApi(`https://omrsite.com/api.php?number=${firstCnic}`);
        if (res2) {
            if (res2.name) names.add(res2.name.trim());
            if (res2.address) addresses.add(res2.address.trim());
            if (res2.numbers) res2.numbers.forEach(n => numbersList.add(n));
        }
    }

    if (!foundAny) {
        return res.status(404).json({ error: "No Result Found" });
    }

    return res.status(200).json({
        names: [...names],
        cnics: [...cnics],
        numbers: [...numbersList],
        addresses: [...addresses]
    });
}
