package com.weatherwise.weatherwise.controller;

import com.weatherwise.weatherwise.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserRepository users;

    public UserController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) {
        var user = users.findByEmailIgnoreCase(authentication.getName())
            .orElseThrow();

        return Map.of(
            "id", user.getId(),
            "name", user.getName(),
            "email", user.getEmail(),
            "createdAt", user.getCreatedAt().toString()
        );
    }
}