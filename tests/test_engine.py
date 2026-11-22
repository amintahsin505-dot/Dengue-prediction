import sys
import unittest
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from engine import DenguardEngine, WARD_COORDINATES, CITY_CENTERS, HORIZONS


class TestDenguardEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = DenguardEngine()

    def test_dataset_loading_and_shape(self):
        self.assertGreater(len(self.engine.data), 30000)
        self.assertEqual(self.engine.data['ward_id'].nunique(), 60)
        self.assertEqual(self.engine.data['city'].nunique(), 5)
        self.assertIn('Chattogram', self.engine.data['city'].unique())
        self.assertIn('Dhaka North', self.engine.data['city'].unique())

    def test_multi_week_weather_lag_pipeline(self):
        """Verifies Criterion 2: Grouped multi-week weather lags per ward."""
        df = self.engine.data
        for col in ['rainfall_mm', 'avg_temp_c', 'relative_humidity_pct', 'dengue_cases']:
            for lag in (1, 2, 3, 4):
                self.assertIn(f'{col}_lag_{lag}w', df.columns)
        self.assertIn('rainfall_accum_2_4w', df.columns)
        self.assertIn('breeding_risk_index', df.columns)

    def test_lag_analysis_correlation(self):
        """Verifies vector breeding clock correlation peaks at 2-3 weeks."""
        lag_res = self.engine.lag_analysis()
        self.assertIn('same_day_rain', lag_res)
        self.assertIn('accum_2_4w', lag_res)
        # Cumulative 2-4 week lag should have higher correlation than same day rain
        self.assertGreater(lag_res['accum_2_4w'], lag_res['same_day_rain'])

    def test_forecasts_and_3_risk_zones(self):
        """Verifies 3-tier risk categories and non-negative predictions."""
        fc = self.engine.forecasts
        self.assertEqual(len(fc), 60)
        for h in HORIZONS:
            self.assertTrue(set(fc[f'tier_{h}w'].unique()).issubset({'High', 'Medium', 'Low'}))
            self.assertTrue((fc[f'predicted_{h}w'] >= 0).all())
            self.assertTrue((fc[f'score_{h}w'] >= 0).all())
            self.assertTrue((fc[f'score_{h}w'] <= 100).all())

    def test_forecast_confidence_intervals(self):
        """Verifies Bonus 2: 95% Confidence Intervals."""
        fc = self.engine.forecasts
        for h in HORIZONS:
            self.assertTrue((fc[f'ci_lower_{h}w'] <= fc[f'predicted_{h}w']).all())
            self.assertTrue((fc[f'predicted_{h}w'] <= fc[f'ci_upper_{h}w']).all())

    def test_ward_coordinates_coverage(self):
        """Verifies 100% of wards have real-world geographic coordinates."""
        dataset_wards = set(self.engine.data['ward_id'].unique())
        mapped_wards = set(WARD_COORDINATES.keys())
        self.assertEqual(dataset_wards, mapped_wards)
        for wid, meta in WARD_COORDINATES.items():
            self.assertIn('lat', meta)
            self.assertIn('lng', meta)
            self.assertIn('name', meta)
            self.assertGreater(meta['lat'], 20.0)
            self.assertGreater(meta['lng'], 88.0)

    def test_what_if_scenario_simulation(self):
        """Verifies public health scenario simulation recalculates tiers."""
        sim_results = self.engine.simulate(rainfall_delta=40.0, temp_delta=1.5, horizon=2)
        self.assertEqual(len(sim_results), 60)
        for r in sim_results:
            self.assertIn('predicted_cases', r)
            self.assertIn('risk_tier', r)
            self.assertIn(r['risk_tier'], {'High', 'Medium', 'Low'})

    def test_api_payload_structure(self):
        """Verifies API payload formatting."""
        payload = self.engine.api_payload('All cities', 2)
        self.assertEqual(len(payload), 60)
        first = payload[0]
        self.assertIn('ward_id', first)
        self.assertIn('predicted_cases', first)
        self.assertIn('ci_lower_95', first)
        self.assertIn('ci_upper_95', first)
        self.assertIn('risk_tier', first)
        self.assertIn('drivers', first)
        self.assertIn('recommended_action', first)


if __name__ == '__main__':
    unittest.main()
