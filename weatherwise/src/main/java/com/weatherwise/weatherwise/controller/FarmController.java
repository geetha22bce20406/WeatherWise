package com.weatherwise.weatherwise.controller;

import com.weatherwise.weatherwise.model.FarmProfile;
import com.weatherwise.weatherwise.repository.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/farms")
public class FarmController {
    private final FarmProfileRepository farms;
    private final UserRepository users;

    public FarmController(FarmProfileRepository farms, UserRepository users) {
        this.farms = farms;
        this.users = users;
    }

    public record FarmRequest(
        @NotBlank @Size(max = 80) String crop,
        @NotBlank @Size(max = 80) String growthStage,
        @NotBlank @Size(max = 100) String activity,
        @Size(max = 100) String location,
        @Size(max = 100) String soilType
    ) {}

    @GetMapping
    public List<Map<String, Object>> getFarms(Authentication auth) {
        return farms.findByUserEmailIgnoreCaseOrderByCreatedAtDesc(auth.getName())
            .stream()
            .map(farm -> Map.<String, Object>of(
                "id", farm.getId(),
                "crop", farm.getCrop(),
                "growthStage", farm.getGrowthStage(),
                "activity", farm.getActivity(),
                "location", farm.getLocation() == null ? "" : farm.getLocation(),
                "soilType", farm.getSoilType() == null ? "" : farm.getSoilType(),
                "createdAt", farm.getCreatedAt().toString()
            ))
            .toList();
    }

    @PostMapping
    public Map<String, Object> saveFarm(
        @Valid @RequestBody FarmRequest request,
        Authentication auth
    ) {
        var user = users.findByEmailIgnoreCase(auth.getName()).orElseThrow();

        FarmProfile farm = new FarmProfile();
        farm.setUser(user);
        farm.setCrop(request.crop().trim());
        farm.setGrowthStage(request.growthStage().trim());
        farm.setActivity(request.activity().trim());
        farm.setLocation(request.location() == null ? "" : request.location().trim());
        farm.setSoilType(request.soilType() == null ? "" : request.soilType().trim());

        farms.save(farm);

        return Map.of(
            "id", farm.getId(),
            "crop", farm.getCrop(),
            "growthStage", farm.getGrowthStage(),
            "activity", farm.getActivity()
        );
    }
}