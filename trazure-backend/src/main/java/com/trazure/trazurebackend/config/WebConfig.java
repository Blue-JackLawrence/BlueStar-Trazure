package com.trazure.trazurebackend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration // 告诉 Spring 这是一个配置类
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**") // 允许所有的 API 路径
                .allowedOriginPatterns("*") // 允许所有的来源 (开发阶段方便，上线再改)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // 允许的操作
                .allowCredentials(true) // 允许带 Cookie
                .maxAge(3600);
    }
}