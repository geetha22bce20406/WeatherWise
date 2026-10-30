package com.weatherwise.weatherwise.repository;

import com.weatherwise.weatherwise.model.FarmProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FarmProfileRepository
    extends JpaRepository<FarmProfile, Long> {
    List<FarmProfile> findByUserEmailIgnoreCaseOrderByCreatedAtDesc(String email);
}