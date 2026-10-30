package com.weatherwise.weatherwise.controller;

import com.weatherwise.weatherwise.model.UserAccount;
import com.weatherwise.weatherwise.repository.UserRepository;
import com.weatherwise.weatherwise.security.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthController(
        UserRepository users,
        PasswordEncoder encoder,
        AuthenticationManager authenticationManager,
        JwtService jwtService
    ) {
        this.users = users;
        this.encoder = encoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    public record SignupRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Email @Size(max = 150) String email,
        @NotBlank @Size(min = 8, max = 72) String password
    ) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {}

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest request) {
        String email = request.email().trim().toLowerCase();

        if (users.existsByEmailIgnoreCase(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", "An account with this email already exists."));
        }

        UserAccount user = new UserAccount();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPassword(encoder.encode(request.password()));
        users.save(user);

        String token = jwtService.generateToken(email);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
            "message", "Account created successfully.",
            "token", token,
            "name", user.getName(),
            "email", user.getEmail()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        String email = request.email().trim().toLowerCase();

        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(email, request.password())
        );

        UserAccount user = users.findByEmailIgnoreCase(email).orElseThrow();
        String token = jwtService.generateToken(email);

        return ResponseEntity.ok(Map.of(
            "message", "Login successful.",
            "token", token,
            "name", user.getName(),
            "email", user.getEmail()
        ));
    }
}