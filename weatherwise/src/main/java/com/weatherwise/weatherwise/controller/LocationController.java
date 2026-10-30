package com.weatherwise.weatherwise.controller;

import com.weatherwise.weatherwise.model.SavedLocation;
import com.weatherwise.weatherwise.repository.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/locations")
public class LocationController {
    private final SavedLocationRepository locations;
    private final UserRepository users;

    public LocationController(
        SavedLocationRepository locations, UserRepository users
    ) {
        this.locations = locations;
        this.users = users;
    }

    public record LocationRequest(
        @NotBlank @Size(max = 120) String city
    ) {}

    @GetMapping
    public List<Map<String, Object>> getLocations(Authentication auth) {
        return locations
            .findByUserEmailIgnoreCaseOrderByCreatedAtDesc(auth.getName())
            .stream()
            .map(location -> Map.<String, Object>of(
                "id", location.getId(),
                "city", location.getCity(),
                "createdAt", location.getCreatedAt().toString()
            ))
            .toList();
    }

    @PostMapping
    public Map<String, Object> saveLocation(
        @Valid @RequestBody LocationRequest request,
        Authentication auth
    ) {
        String city = request.city().trim();

        if (locations.existsByUserEmailIgnoreCaseAndCityIgnoreCase(
            auth.getName(), city
        )) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT, "This city is already saved."
            );
        }

        var user = users.findByEmailIgnoreCase(auth.getName()).orElseThrow();
        SavedLocation location = new SavedLocation();
        location.setUser(user);
        location.setCity(city);
        locations.save(location);

        return Map.of("id", location.getId(), "city", location.getCity());
    }

    @DeleteMapping("/{id}")
    public void deleteLocation(
        @PathVariable Long id, Authentication auth
    ) {
        SavedLocation location = locations.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Saved city not found."
            ));

        if (!location.getUser().getEmail().equalsIgnoreCase(auth.getName())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }

        locations.delete(location);
    }
}