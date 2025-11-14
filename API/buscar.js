/**
 * ESTE É O SEU BACKEND.
 * Ele será executado pela Vercel como uma "Serverless Function".
 * O nome do arquivo (buscar.js) define a rota (/api/buscar).
 */
export default async function handler(request, response) {
    // 1. Obter a API Key (armazenada de forma segura na Vercel)
    // Você DEVE configurar isso no painel do seu projeto na Vercel.
    const API_KEY = process.env.SPTRANS_API_KEY;

    // 2. Obter os termos da busca (ex: /api/buscar?termos=8000)
    const { termos } = request.query;

    // 3. Validação
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

    try {
        // --- PASSO 1: Autenticar na SPTrans para obter o cookie ---
        // Funções Serverless são "stateless" (não guardam estado).
        // Precisamos autenticar CADA VEZ que a função é chamada.
        
        const authUrl = `https://api.olhovivo.sptrans.com.br/Login/Autenticar?token=${API_KEY}`;
        const authResponse = await fetch(authUrl, {
            method: 'POST'
        });

        // A SPTrans retorna 'true' no body e o cookie no header
        const authBody = await authResponse.text();
        const cookie = authResponse.headers.get('set-cookie');

        if (authBody !== 'true' || !cookie) {
            console.error("Falha na autenticação SPTrans:", authBody);
            return response.status(401).json({ message: "Falha ao autenticar com a SPTrans. Verifique a API Key." });
        }

        // --- PASSO 2: Buscar a linha usando o cookie de autenticação ---
        
        const searchUrl = `https://api.olhovivo.sptrans.com.br/Linha/Buscar?termosBusca=${encodeURIComponent(termos)}`;
        
        const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                // Enviamos o cookie que acabamos de receber
                'Cookie': cookie
            }
        });

        if (!searchResponse.ok) {
            console.error("Erro na busca da linha:", searchResponse.statusText);
            return response.status(502).json({ message: "Erro ao buscar dados na SPTrans." });
        }

        // --- PASSO 3: Enviar os dados de volta para o front-end ---
        const data = await searchResponse.json();

        // Configura o cache na Vercel (Edge): 60 segundos
        // Isso evita que seu backend chame a SPTrans em toda requisição idêntica.
        response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

        // Envia a resposta final
        return response.status(200).json(data);

    } catch (error) {
        console.error("Erro interno do backend:", error);
        return response.status(500).json({ 
            message: "Erro interno do servidor.",
            error: error.message 
        });
    }
}
