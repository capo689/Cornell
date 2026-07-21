import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { WeatherService } from './../src/weather.service';

interface WorkflowState {
  readiness: number;
  event: { revision: number };
  weather: { live: boolean; source: string };
  members: Array<{ id: string; name: string }>;
  jobs: unknown[];
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WeatherService)
      .useValue({
        getWeather: jest.fn().mockResolvedValue({
          source: 'Open-Meteo',
          live: true,
          location: 'Schoellkopf Field',
          temperatureF: 72,
          apparentTemperatureF: 72,
          highF: 78,
          lowF: 59,
          precipitationProbability: 12,
          windMph: 8,
          windGustMph: 14,
          condition: 'Partly cloudy',
          observedAt: '2026-07-21T12:00',
          fetchedAt: '2026-07-21T16:00:00.000Z',
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('completes the coordinator-to-member demo workflow', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/demo/reset')
      .set('x-demo-role', 'coordinator')
      .expect(200);

    const initialResponse = await request(server)
      .get('/api/demo/state')
      .expect(200);
    const initial = initialResponse.body as WorkflowState;
    expect(initial.readiness).toBe(82);
    expect(initial.weather.live).toBe(true);
    expect(initial.weather.source).toBe('Open-Meteo');
    const substitute = initial.members.find(
      (member) => member.name === 'Alex Rivera',
    );
    expect(substitute).toBeDefined();
    const substituteId = substitute?.id ?? '';

    await request(server).post('/api/demo/publish').expect(403);
    await request(server)
      .post('/api/demo/resolve-absence')
      .set('x-demo-role', 'member')
      .send({ memberId: substituteId })
      .expect(403);
    await request(server)
      .post('/api/demo/resolve-absence')
      .set('x-demo-role', 'coordinator')
      .set('x-demo-user', 'Maya Chen')
      .send({ memberId: substituteId })
      .expect(201);
    await request(server)
      .post('/api/demo/publish')
      .set('x-demo-role', 'coordinator')
      .set('x-demo-user', 'Maya Chen')
      .expect(201);
    await request(server)
      .post('/api/demo/acknowledge')
      .set('x-demo-user', 'Jordan Lee')
      .expect(201);

    const completeResponse = await request(server)
      .get('/api/demo/state')
      .expect(200);
    const complete = completeResponse.body as WorkflowState;
    expect(complete.readiness).toBe(100);
    expect(complete.event.revision).toBe(4);
    expect(complete.jobs.length).toBe(3);
  });

  afterAll(async () => {
    await app.close();
  });
});
