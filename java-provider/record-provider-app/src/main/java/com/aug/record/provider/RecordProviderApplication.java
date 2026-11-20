package com.aug.record.provider;

import org.apache.dubbo.config.spring.context.annotation.EnableDubbo;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Dubbo Provider 启动类。
 */
@SpringBootApplication
@MapperScan("com.aug.record.provider.mapper")
@EnableDubbo(scanBasePackages = "com.aug.record.provider.service")
public class RecordProviderApplication {

    public static void main(String[] args) {
        SpringApplication.run(RecordProviderApplication.class, args);
    }
}
