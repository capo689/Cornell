import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('normalizes and caches live Open-Meteo conditions', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          current: {
            time: '2026-07-21T15:00',
            temperature_2m: 73.6,
            apparent_temperature: 75.2,
            weather_code: 2,
            wind_speed_10m: 7.6,
            wind_gusts_10m: 13.2,
          },
          daily: {
            temperature_2m_max: [80.1],
            temperature_2m_min: [61.2],
            precipitation_probability_max: [18],
          },
        }),
    } as Response);
    const service = new WeatherService();

    const first = await service.getWeather();
    const second = await service.getWeather();

    expect(first.live).toBe(true);
    expect(first.temperatureF).toBe(74);
    expect(first.apparentTemperatureF).toBe(75);
    expect(first.highF).toBe(80);
    expect(first.lowF).toBe(61);
    expect(first.precipitationProbability).toBe(18);
    expect(first.windMph).toBe(8);
    expect(first.windGustMph).toBe(13);
    expect(first.condition).toBe('Partly cloudy');
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a safe unavailable state when the provider fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const result = await new WeatherService().getWeather();

    expect(result.live).toBe(false);
    expect(result.temperatureF).toBeNull();
    expect(result.condition).toBe('Live conditions unavailable');
    expect(result.source).toBe('Open-Meteo');
  });
});
