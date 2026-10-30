package com.weatherwise.weatherwise.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "saved_locations",
    uniqueConstraints = @UniqueConstraint(
        columnNames = {"user_id", "city"}
    )
)
public class SavedLocation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserAccount user;

    @Column(nullable = false, length = 120)
    private String city;

    private LocalDateTime createdAt = LocalDateTime.now();

    public SavedLocation() {}

    public Long getId() { return id; }
    public UserAccount getUser() { return user; }
    public String getCity() { return city; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setUser(UserAccount user) { this.user = user; }
    public void setCity(String city) { this.city = city; }
}