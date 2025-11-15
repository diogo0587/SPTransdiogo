export default async function handler(request, response) {
    const API_KEY = "efea508f6acbc1219959df3033f59c1d50e45b7590dc446204cfe04a2476a4ef";
    const { termos } = request.query;

    if (!API_KEY) {
        return response.status(500).json({ 
            message: "Erro de servidor: A chave da API SPTrans não foi configurada." 
        });
    }
    if (!termos) {
        return response.status(400).json({ 
            message: "Termo de busca não fornecido." 
        });
    }

    let cookie = null;

    try {
        // --- PASSO 1: Autenticar na SPTrans para obter o cookie ---
        const authUrl = `https://api.olhovivo.sptrans.com.br/v2.1/Login/Autenticar?token=${API_KEY}`;
        const authResponse = await fetch(authUrl, {
            method: 'POST'
        });

        const authBody = await authResponse.text();
        cookie = authResponse.headers.get('set-cookie');

        if (authBody !== 'true' || !cookie) {
            console.error("Falha na autenticação SPTrans:", authBody);
            return response.status(401).json({ message: "Falha ao autenticar com a SPTrans. Verifique a API Key." });
        }

    } catch (authError) {
        console.error("Erro na etapa de autenticação:", authError);
        return response.status(500).json({ 
            message: "Erro interno ao tentar autenticar.",
            error: authError.message 
        });
    }

    // Se chegou aqui, a autenticação funcionou e temos um cookie.
    
    try {
        // --- PASSO 2: Buscar a linha usando o cookie de autenticação ---
        const searchUrl = `https://api.olhovivo.sptrans.com.br/Linha/Buscar?termosBusca=${encodeURIComponent(termos)}`;
        
        const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Cookie': cookie
            }
        });

        if (!searchResponse.ok) {
            // Se a SPTrans retornar um erro (404, 500, etc.)
            console.error("Erro na busca da linha (Status não OK):", searchResponse.statusText);
            return response.status(502).json({ message: "Erro ao buscar dados na SPTrans (Status: " + searchResponse.status + ")" });
        }

        // --- PASSO 3: Tentar processar a resposta como JSON ---
        
        // **A CORREÇÃO ESTÁ AQUI**
        // Vamos primeiro pegar o texto da resposta.
        const responseText = await searchResponse.text();

        let data;
        try {
            // Agora tentamos fazer o parse do texto
            data = JSON.parse(responseText);
        } catch (parseError) {
            // Se falhar o parse, é porque a SPTrans não retornou JSON.
            // Isso geralmente acontece se o cookie expirou e ela retornou HTML.
            console.error("Erro de JSON.parse:", parseError.message);
            console.error("Resposta recebida da SPTrans (que NÃO é JSON):", responseText.substring(0, 200) + "..."); // Loga os primeiros 200 caracteres
            return response.status(502).json({ message: "A API da SPTrans retornou dados inválidos (não-JSON). Provavelmente o cookie expirou." });
        }
        
        // --- PASSO 4: Enviar os dados de volta para o front-end ---
        response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
        return response.status(200).json(data);

    } catch (error) {
        console.error("Erro interno do backend na etapa de busca:", error);
        return response.status(500).json({ 
            message: "Erro interno do servidor na etapa de busca.",
            error: error.message 
        });
    }
}
