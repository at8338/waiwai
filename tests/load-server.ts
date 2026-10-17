// Isolated child process for the load test. Never expose this harness publicly.
import { createServer } from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { attachOffice } from '../server/office.ts';
const server = createServer();
const close = attachOffice(server);
const lag = monitorEventLoopDelay({ resolution: 10 });
lag.enable();
let cpu = process.cpuUsage();
server.listen(0, '127.0.0.1', () => process.send?.({ port: (server.address() as { port: number }).port }));
process.on('message', (message) => {
  if (message === 'reset') { cpu = process.cpuUsage(); lag.reset(); process.send?.({ reset: true }); }
  if (message === 'metrics') process.send?.({ cpuMicros: process.cpuUsage(cpu), rssBytes: process.memoryUsage().rss, eventLoopP99Ms: lag.percentile(99) / 1e6 });
  if (message === 'close') { close(); lag.disable(); server.close(() => process.exit()); }
});
process.on('disconnect', () => { close(); server.close(); });
