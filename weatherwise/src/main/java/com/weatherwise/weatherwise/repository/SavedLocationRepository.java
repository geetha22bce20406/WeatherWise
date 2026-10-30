package com.weatherwise.weatherwise.repository;

import com.weatherwise.weatherwise.model.SavedLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SavedLocationRepository
    extends JpaRepository<SavedLocation, Long> {
    List<SavedLocation> findByUserEmailIgnoreCaseOrderByCreatedAtDesc(String email);
    boolean existsByUserEmailIgnoreCaseAndCityIgnoreCase(String email, String city);
}