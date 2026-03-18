import pytest
import sys
from pathlib import Path

# Add the src directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from ocr_to_hf_layoutlm import norm_box


class TestBboxNormalization:
    """Test bounding box normalization to LayoutLM 0-1000 scale."""
    
    def test_norm_box_basic(self):
        """Test basic bounding box normalization."""
        box = [100, 200, 300, 400]  # x0, y0, x1, y1
        img_w, img_h = 1000, 1000
        
        result = norm_box(box, img_w, img_h)
        
        # Expected: [100, 200, 300, 400] (since image is 1000x1000)
        assert result == [100, 200, 300, 400]
        assert all(0 <= val <= 1000 for val in result)
    
    def test_norm_box_scaling(self):
        """Test scaling from different image dimensions."""
        box = [50, 100, 150, 200]
        img_w, img_h = 500, 1000
        
        result = norm_box(box, img_w, img_h)
        
        # Expected: [100, 100, 300, 200] (x scaled by 2, y scaled by 1)
        assert result == [100, 100, 300, 200]
        assert all(0 <= val <= 1000 for val in result)
    
    def test_norm_box_edge_cases(self):
        """Test edge cases and boundary conditions."""
        # Zero dimensions
        box = [0, 0, 100, 100]
        img_w, img_h = 1000, 1000
        result = norm_box(box, img_w, img_h)
        assert result == [0, 0, 100, 100]
        
        # Maximum dimensions
        box = [900, 900, 1000, 1000]
        result = norm_box(box, img_w, img_h)
        assert result == [900, 900, 1000, 1000]
    
    def test_norm_box_rounding(self):
        """Test that values are properly rounded to integers."""
        box = [10.5, 20.7, 30.3, 40.9]
        img_w, img_h = 100, 100
        
        result = norm_box(box, img_w, img_h)
        
        # Should round to integers: [105, 207, 303, 409]
        assert result == [105, 207, 303, 409]
        assert all(isinstance(val, int) for val in result)
    
    def test_norm_box_out_of_bounds(self):
        """Test boxes that would normalize beyond 0-1000 range."""
        box = [1200, 1500, 1800, 2000]  # Larger than image
        img_w, img_h = 1000, 1000
        
        result = norm_box(box, img_w, img_h)
        
        # Should be clipped to 1000
        assert result == [1000, 1000, 1000, 1000]
    
    def test_norm_box_negative_values(self):
        """Test handling of negative coordinates."""
        box = [-100, -50, 200, 300]
        img_w, img_h = 1000, 1000
        
        result = norm_box(box, img_w, img_h)
        
        # Negative values should be clipped to 0
        assert result == [0, 0, 200, 300]
    
    def test_norm_box_zero_image_dimensions(self):
        """Test handling of zero image dimensions (edge case)."""
        box = [100, 100, 200, 200]
        img_w, img_h = 0, 0
        
        # Should handle division by zero gracefully
        with pytest.raises(ZeroDivisionError):
            norm_box(box, img_w, img_h)


if __name__ == "__main__":
    pytest.main([__file__])