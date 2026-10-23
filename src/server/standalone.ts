import http from 'node:http';
import { handleReportApi, respondError } from './reportApi';

// The standalone service accepts caller-supplied JSON; embedding hosts own authentication and routing.
const server = http.createServer((request, response) => {
  void handleReportApi(request, response).then(handled => {
    if (!handled) { response.statusCode = 404; response.end('Not found'); }
  }).catch(error => respondError(response, error));
});
const port = Number(process.env.REPORT_ENGINE_PORT ?? 3001);
server.listen(port, '127.0.0.1', () => console.log(`Report API: http://127.0.0.1:${port}`));
